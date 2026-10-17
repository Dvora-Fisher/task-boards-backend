import { prisma, type TxClient } from '../db/prisma.js';
import type { Prisma, Task } from '../generated/prisma/client.js';
import {
  assertBoardUsers,
  loadBoardAccess,
  requireBoardEdit,
  visibleTaskWhere,
} from '../authorization/boardAccess.js';
import { AppError, errors } from '../utils/AppError.js';
import { dateOnlyToDate, startOfUtcDay } from '../utils/dates.js';
import { paginated, toSkipTake } from '../utils/pagination.js';
import { taskInclude, toTaskDto, type TaskDto } from '../utils/serializers.js';
import { checkSchedule, type CreateTaskInput, type ListTasksQuery, type UpdateTaskInput } from '../validation/task.schemas.js';
import { blockedUsersFor, findConflicts, lockUsersCalendars } from './availability.js';

function timeConflictError(conflicts: { start: Date; end: Date }[]): AppError {
  return new AppError(409, 'TIME_CONFLICT', 'The selected time overlaps another scheduled task', {
    conflicts: conflicts.map((c) => ({ startAt: c.start.toISOString(), endAt: c.end.toISOString() })),
  });
}

/** Locks the affected users' calendars and rejects the write if the time is already taken. */
async function assertNoTimeConflict(
  tx: TxClient,
  task: { startAt: Date | null; endAt: Date | null; status: Task['status'] },
  userIds: string[],
  excludeTaskId?: string,
): Promise<void> {
  if (!task.startAt || !task.endAt || task.status === 'DONE' || userIds.length === 0) return;
  await lockUsersCalendars(tx, userIds);
  const conflicts = await findConflicts(tx, userIds, { start: task.startAt, end: task.endAt }, excludeTaskId);
  if (conflicts.length > 0) throw timeConflictError(conflicts);
}

/** Loads a task the user is allowed to see (404 otherwise) plus the user's board access. */
async function loadVisibleTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) throw errors.taskNotFound();

  // hides the task if the board itself is not visible
  const boardAccess = await loadBoardAccess(task.boardId, userId).catch(() => {
    throw errors.taskNotFound();
  });
  const visible =
    task.audience === 'BOARD' || task.createdById === userId || task.assignments.some((a) => a.user.id === userId);
  if (!visible) throw errors.taskNotFound();
  return { task, ...boardAccess };
}

export async function listTasks(boardId: string, userId: string, q: ListTasksQuery) {
  await loadBoardAccess(boardId, userId);

  const and: Prisma.TaskWhereInput[] = [visibleTaskWhere(userId)];
  if (q.status) and.push({ status: { in: q.status } });
  if (q.priority) and.push({ priority: { in: q.priority } });
  if (q.schedule === 'NONE') and.push({ dueDate: null, startAt: null });
  if (q.schedule === 'DATE') and.push({ dueDate: { not: null } });
  if (q.schedule === 'TIMED') and.push({ startAt: { not: null } });
  if (q.assignedToMe) and.push({ assignments: { some: { userId } } });
  if (q.search) {
    and.push({
      OR: [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ],
    });
  }
  if (q.from || q.to) {
    // date-only tasks: their day is inside the range; timed tasks: overlap the range
    and.push({
      OR: [
        {
          dueDate: {
            ...(q.from && { gte: startOfUtcDay(q.from) }),
            ...(q.to && { lt: q.to }),
          },
        },
        {
          startAt: q.to ? { lt: q.to } : { not: null },
          endAt: q.from ? { gt: q.from } : { not: null },
        },
      ],
    });
  }

  const where: Prisma.TaskWhereInput = { boardId, AND: and };
  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    q.sort === 'startAt' || q.sort === 'dueDate'
      ? [{ [q.sort]: { sort: q.order, nulls: 'last' } }, { createdAt: 'desc' }]
      : [{ [q.sort]: q.order }];
  orderBy.push({ id: 'asc' });

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({ where, include: taskInclude, orderBy, ...toSkipTake(q.page, q.pageSize) }),
    prisma.task.count({ where }),
  ]);
  return paginated(tasks.map(toTaskDto), total, q.page, q.pageSize);
}

export async function createTask(boardId: string, userId: string, input: CreateTaskInput): Promise<TaskDto> {
  const task = await prisma.$transaction(async (tx) => {
    const { board } = await requireBoardEdit(boardId, userId, tx);
    await assertBoardUsers(board, input.assigneeIds, tx);

    const startAt = input.startAt ?? null;
    const endAt = input.endAt ?? null;
    await assertNoTimeConflict(tx, { startAt, endAt, status: input.status }, blockedUsersFor(input.assigneeIds, userId));

    return tx.task.create({
      data: {
        boardId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        audience: input.audience,
        dueDate: input.dueDate ? dateOnlyToDate(input.dueDate) : null,
        startAt,
        endAt,
        createdById: userId,
        assignments: { create: input.assigneeIds.map((id) => ({ userId: id })) },
      },
      include: taskInclude,
    });
  });
  return toTaskDto(task);
}

export async function getTask(taskId: string, userId: string): Promise<TaskDto> {
  const { task } = await loadVisibleTask(taskId, userId);
  return toTaskDto(task);
}

export async function updateTask(taskId: string, userId: string, input: UpdateTaskInput): Promise<TaskDto> {
  const { task: current, board, access } = await loadVisibleTask(taskId, userId);
  if (!access.canEdit) throw errors.forbidden('You can only view tasks on this board');

  // Sending a time slot replaces a due date and vice versa, unless the other field is sent explicitly.
  const sendsTimed = input.startAt != null || input.endAt != null;
  const sendsDate = input.dueDate != null;
  const next = {
    dueDate:
      input.dueDate !== undefined
        ? input.dueDate
        : sendsTimed
          ? null
          : current.dueDate
            ? current.dueDate.toISOString().slice(0, 10)
            : null,
    startAt: input.startAt !== undefined ? input.startAt : sendsDate ? null : current.startAt,
    endAt: input.endAt !== undefined ? input.endAt : sendsDate ? null : current.endAt,
  };

  const issues: { message: string; path: string[] }[] = [];
  checkSchedule(next, { addIssue: (i) => issues.push(i) });
  const audience = input.audience ?? current.audience;
  const assigneeIds = input.assigneeIds ?? current.assignments.map((a) => a.user.id);
  if (audience === 'SELECTED' && assigneeIds.length === 0) {
    issues.push({ message: 'Select at least one user for a SELECTED task', path: ['assigneeIds'] });
  }
  if (issues.length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }

  const status = input.status ?? current.status;
  const scheduleChanged =
    next.startAt?.getTime() !== current.startAt?.getTime() || next.endAt?.getTime() !== current.endAt?.getTime();
  const assigneesChanged = input.assigneeIds !== undefined;
  const reactivated = current.status === 'DONE' && status !== 'DONE';

  const updated = await prisma.$transaction(async (tx) => {
    if (input.assigneeIds) await assertBoardUsers(board, input.assigneeIds, tx);
    if (scheduleChanged || assigneesChanged || reactivated) {
      await assertNoTimeConflict(
        tx,
        { startAt: next.startAt, endAt: next.endAt, status },
        blockedUsersFor(assigneeIds, current.createdById),
        taskId,
      );
    }

    if (input.assigneeIds) {
      await tx.taskAssignment.deleteMany({ where: { taskId, userId: { notIn: input.assigneeIds } } });
      await tx.taskAssignment.createMany({
        data: input.assigneeIds.map((id) => ({ taskId, userId: id })),
        skipDuplicates: true,
      });
    }

    return tx.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priority !== undefined && { priority: input.priority }),
        status,
        audience,
        dueDate: next.dueDate ? dateOnlyToDate(next.dueDate) : null,
        startAt: next.startAt,
        endAt: next.endAt,
      },
      include: taskInclude,
    });
  });
  return toTaskDto(updated);
}

export async function deleteTask(taskId: string, userId: string): Promise<void> {
  const { access } = await loadVisibleTask(taskId, userId);
  if (!access.canEdit) throw errors.forbidden('You can only view tasks on this board');
  await prisma.task.delete({ where: { id: taskId } });
}
