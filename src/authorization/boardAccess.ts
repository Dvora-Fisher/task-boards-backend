import type { Board } from '../generated/prisma/client.js';
import { prisma, type TxClient } from '../db/prisma.js';
import { AppError, errors } from '../utils/AppError.js';

export interface BoardAccess {
  isOwner: boolean;
  isMember: boolean;
  /** owner, or member of a SHARED board */
  canView: boolean;
  /** owner, or member of an OPEN SHARED board — may create/edit/delete tasks and reminders */
  canEdit: boolean;
  /** owner only — board settings, share link, members */
  canManage: boolean;
}

export interface BoardWithAccess {
  board: Board;
  access: BoardAccess;
}

export function computeAccess(board: Pick<Board, 'ownerId' | 'visibility' | 'isOpen'>, userId: string, isMember: boolean): BoardAccess {
  const isOwner = board.ownerId === userId;
  const sharedMember = board.visibility === 'SHARED' && isMember;
  return {
    isOwner,
    isMember: sharedMember,
    canView: isOwner || sharedMember,
    canEdit: isOwner || (sharedMember && board.isOpen),
    canManage: isOwner,
  };
}

/**
 * Loads a board and the current user's access to it.
 * A board the user may not view is reported as 404 so its existence is not revealed.
 */
export async function loadBoardAccess(boardId: string, userId: string, db: TxClient | typeof prisma = prisma): Promise<BoardWithAccess> {
  const board = await db.board.findUnique({
    where: { id: boardId },
    include: { members: { where: { userId }, select: { userId: true } } },
  });
  if (!board) throw errors.boardNotFound();

  const { members, ...plain } = board;
  const access = computeAccess(plain, userId, members.length > 0);
  if (!access.canView) throw errors.boardNotFound();
  return { board: plain, access };
}

export async function requireBoardEdit(boardId: string, userId: string, db: TxClient | typeof prisma = prisma) {
  const result = await loadBoardAccess(boardId, userId, db);
  if (!result.access.canEdit) {
    throw errors.forbidden(
      result.board.visibility === 'SHARED'
        ? 'This board is closed: only the board owner can change its content'
        : 'Only the board owner can change this board',
    );
  }
  return result;
}

export async function requireBoardManage(boardId: string, userId: string, db: TxClient | typeof prisma = prisma) {
  const result = await loadBoardAccess(boardId, userId, db);
  if (!result.access.canManage) throw errors.forbidden('Only the board owner can do this');
  return result;
}

/** Checks that every user id is the owner or a member of the board. */
export async function assertBoardUsers(board: Pick<Board, 'id' | 'ownerId'>, userIds: string[], db: TxClient | typeof prisma = prisma): Promise<void> {
  const others = userIds.filter((id) => id !== board.ownerId);
  if (others.length === 0) return;
  const found = await db.boardMember.findMany({
    where: { boardId: board.id, userId: { in: others } },
    select: { userId: true },
  });
  const foundIds = new Set(found.map((m) => m.userId));
  const missing = others.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new AppError(400, 'NOT_A_BOARD_MEMBER', 'Some selected users are not members of this board', { userIds: missing });
  }
}

/** Prisma filter: items with audience BOARD, or created by / selected for the user. */
export function visibleTaskWhere(userId: string) {
  return {
    OR: [{ audience: 'BOARD' as const }, { createdById: userId }, { assignments: { some: { userId } } }],
  };
}

export function visibleReminderWhere(userId: string) {
  return {
    OR: [{ audience: 'BOARD' as const }, { createdById: userId }, { recipients: { some: { userId } } }],
  };
}
