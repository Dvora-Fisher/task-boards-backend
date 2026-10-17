import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { loadBoardAccess, requireBoardManage } from '../authorization/boardAccess.js';
import { AppError } from '../utils/AppError.js';
import { toUserSummary, userSelect, type UserSummaryDto } from '../utils/serializers.js';

export interface MemberDto {
  user: UserSummaryDto;
  isOwner: boolean;
  joinedAt: string;
}

/** The owner is listed first, then members by join date. */
export async function listMembers(boardId: string, userId: string): Promise<MemberDto[]> {
  const { board } = await loadBoardAccess(boardId, userId);
  const [owner, members] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: board.ownerId }, select: userSelect }),
    prisma.boardMember.findMany({
      where: { boardId },
      include: { user: { select: userSelect } },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    }),
  ]);
  return [
    { user: toUserSummary(owner), isOwner: true, joinedAt: board.createdAt.toISOString() },
    ...members.map((m) => ({ user: toUserSummary(m.user), isOwner: false, joinedAt: m.joinedAt.toISOString() })),
  ];
}

export async function addMember(boardId: string, userId: string, email: string): Promise<MemberDto> {
  const { board } = await requireBoardManage(boardId, userId);
  if (board.visibility !== 'SHARED') {
    throw new AppError(400, 'BOARD_IS_PRIVATE', 'Members can only be added to SHARED boards');
  }

  const user = await prisma.user.findUnique({ where: { email }, select: userSelect });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'No user is registered with this email');
  if (user.id === board.ownerId) throw new AppError(409, 'CANNOT_ADD_OWNER', 'The owner is already part of the board');

  try {
    const member = await prisma.boardMember.create({ data: { boardId, userId: user.id } });
    return { user: toUserSummary(user), isOwner: false, joinedAt: member.joinedAt.toISOString() };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'ALREADY_MEMBER', 'This user is already a member of the board');
    }
    throw err;
  }
}

/**
 * Removes a member. Tasks and reminders they created stay on the board.
 * Their task assignments and reminder selections on THIS board are removed in the same transaction,
 * so no assignment points to a user who can no longer see the board.
 */
export async function removeMember(boardId: string, userId: string, memberUserId: string): Promise<void> {
  const { board } = await requireBoardManage(boardId, userId);
  if (memberUserId === board.ownerId) {
    throw new AppError(400, 'CANNOT_REMOVE_OWNER', 'The board owner cannot be removed');
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.boardMember.deleteMany({ where: { boardId, userId: memberUserId } });
    if (deleted.count === 0) throw new AppError(404, 'MEMBER_NOT_FOUND', 'This user is not a member of the board');

    await tx.taskAssignment.deleteMany({ where: { userId: memberUserId, task: { boardId } } });
    await tx.reminderRecipient.deleteMany({ where: { userId: memberUserId, reminder: { boardId } } });
  });
}
