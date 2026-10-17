import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { assertBoardUsers, loadBoardAccess, requireBoardEdit, visibleReminderWhere } from '../authorization/boardAccess.js';
import { AppError, errors } from '../utils/AppError.js';
import { paginated, toSkipTake } from '../utils/pagination.js';
import { reminderInclude, toReminderDto, type ReminderDto } from '../utils/serializers.js';
import type { CreateReminderInput, ListRemindersQuery, UpdateReminderInput } from '../validation/reminder.schemas.js';

async function loadVisibleReminder(reminderId: string, userId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId }, include: reminderInclude });
  if (!reminder) throw errors.reminderNotFound();

  const boardAccess = await loadBoardAccess(reminder.boardId, userId).catch(() => {
    throw errors.reminderNotFound();
  });
  const visible =
    reminder.audience === 'BOARD' ||
    reminder.createdById === userId ||
    reminder.recipients.some((r) => r.user.id === userId);
  if (!visible) throw errors.reminderNotFound();
  return { reminder, ...boardAccess };
}

export async function listReminders(boardId: string, userId: string, q: ListRemindersQuery) {
  await loadBoardAccess(boardId, userId);
  const and: Prisma.ReminderWhereInput[] = [visibleReminderWhere(userId)];
  if (q.from || q.to) and.push({ remindAt: { ...(q.from && { gte: q.from }), ...(q.to && { lt: q.to }) } });
  if (q.search) {
    and.push({
      OR: [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ],
    });
  }
  const where: Prisma.ReminderWhereInput = { boardId, AND: and };
  const [reminders, total] = await Promise.all([
    prisma.reminder.findMany({
      where,
      include: reminderInclude,
      orderBy: [{ remindAt: 'asc' }, { id: 'asc' }],
      ...toSkipTake(q.page, q.pageSize),
    }),
    prisma.reminder.count({ where }),
  ]);
  return paginated(reminders.map(toReminderDto), total, q.page, q.pageSize);
}

export async function createReminder(boardId: string, userId: string, input: CreateReminderInput): Promise<ReminderDto> {
  const { board } = await requireBoardEdit(boardId, userId);
  await assertBoardUsers(board, input.recipientIds);
  const reminder = await prisma.reminder.create({
    data: {
      boardId,
      title: input.title,
      description: input.description ?? null,
      remindAt: input.remindAt,
      audience: input.audience,
      createdById: userId,
      recipients: { create: input.recipientIds.map((id) => ({ userId: id })) },
    },
    include: reminderInclude,
  });
  return toReminderDto(reminder);
}

export async function getReminder(reminderId: string, userId: string): Promise<ReminderDto> {
  const { reminder } = await loadVisibleReminder(reminderId, userId);
  return toReminderDto(reminder);
}

export async function updateReminder(reminderId: string, userId: string, input: UpdateReminderInput): Promise<ReminderDto> {
  const { reminder: current, board, access } = await loadVisibleReminder(reminderId, userId);
  if (!access.canEdit) throw errors.forbidden('You can only view reminders on this board');

  const audience = input.audience ?? current.audience;
  const recipientIds = input.recipientIds ?? current.recipients.map((r) => r.user.id);
  if (audience === 'SELECTED' && recipientIds.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      { path: 'recipientIds', message: 'Select at least one user for a SELECTED reminder' },
    ]);
  }
  if (input.recipientIds) await assertBoardUsers(board, input.recipientIds);

  const updated = await prisma.$transaction(async (tx) => {
    if (input.recipientIds) {
      await tx.reminderRecipient.deleteMany({ where: { reminderId, userId: { notIn: input.recipientIds } } });
      await tx.reminderRecipient.createMany({
        data: input.recipientIds.map((id) => ({ reminderId, userId: id })),
        skipDuplicates: true,
      });
    }
    return tx.reminder.update({
      where: { id: reminderId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.remindAt !== undefined && { remindAt: input.remindAt }),
        audience,
      },
      include: reminderInclude,
    });
  });
  return toReminderDto(updated);
}

export async function deleteReminder(reminderId: string, userId: string): Promise<void> {
  const { access } = await loadVisibleReminder(reminderId, userId);
  if (!access.canEdit) throw errors.forbidden('You can only view reminders on this board');
  await prisma.reminder.delete({ where: { id: reminderId } });
}
