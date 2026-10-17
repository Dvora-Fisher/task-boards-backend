import type { Board, Reminder, Task, User } from '../generated/prisma/client.js';
import type { BoardAccess } from '../authorization/boardAccess.js';
import { dateToDateOnly } from './dates.js';

/** Public user shape — never contains the password hash. */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserSummaryDto {
  id: string;
  name: string;
  email: string;
}

type UserLike = Pick<User, 'id' | 'name' | 'email'>;

export const userSelect = { id: true, name: true, email: true } as const;

export function toUserDto(user: Pick<User, 'id' | 'email' | 'name' | 'createdAt'>): UserDto {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() };
}

export function toUserSummary(user: UserLike): UserSummaryDto {
  return { id: user.id, name: user.name, email: user.email };
}

export function toBoardDto(board: Board & { owner: UserLike; _count: { members: number } }, access: BoardAccess) {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    visibility: board.visibility,
    isOpen: board.isOpen,
    owner: toUserSummary(board.owner),
    memberCount: board._count.members,
    /** Only the owner of a SHARED board receives the share token. */
    shareToken: access.isOwner && board.visibility === 'SHARED' ? board.shareToken : null,
    myAccess: access,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export const boardInclude = {
  owner: { select: userSelect },
  _count: { select: { members: true } },
} as const;

export type ScheduleType = 'NONE' | 'DATE' | 'TIMED';

export function scheduleTypeOf(task: Pick<Task, 'dueDate' | 'startAt'>): ScheduleType {
  if (task.startAt) return 'TIMED';
  if (task.dueDate) return 'DATE';
  return 'NONE';
}

export const taskInclude = {
  createdBy: { select: userSelect },
  assignments: { select: { user: { select: userSelect } }, orderBy: { assignedAt: 'asc' } },
} as const;

export function toTaskDto(task: Task & { createdBy: UserLike | null; assignments: { user: UserLike }[] }) {
  return {
    id: task.id,
    boardId: task.boardId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    audience: task.audience,
    scheduleType: scheduleTypeOf(task),
    dueDate: task.dueDate ? dateToDateOnly(task.dueDate) : null,
    startAt: task.startAt?.toISOString() ?? null,
    endAt: task.endAt?.toISOString() ?? null,
    createdBy: task.createdBy ? toUserSummary(task.createdBy) : null,
    assignees: task.assignments.map((a) => toUserSummary(a.user)),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export const reminderInclude = {
  createdBy: { select: userSelect },
  recipients: { select: { user: { select: userSelect } } },
} as const;

export function toReminderDto(reminder: Reminder & { createdBy: UserLike | null; recipients: { user: UserLike }[] }) {
  return {
    id: reminder.id,
    boardId: reminder.boardId,
    title: reminder.title,
    description: reminder.description,
    remindAt: reminder.remindAt.toISOString(),
    audience: reminder.audience,
    createdBy: reminder.createdBy ? toUserSummary(reminder.createdBy) : null,
    recipients: reminder.recipients.map((r) => toUserSummary(r.user)),
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

export type BoardDto = ReturnType<typeof toBoardDto>;
export type TaskDto = ReturnType<typeof toTaskDto>;
export type ReminderDto = ReturnType<typeof toReminderDto>;
