import { randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { computeAccess, loadBoardAccess, requireBoardManage } from '../authorization/boardAccess.js';
import { AppError, errors } from '../utils/AppError.js';
import { paginated, toSkipTake } from '../utils/pagination.js';
import { boardInclude, toBoardDto, type BoardDto } from '../utils/serializers.js';
import type { CreateBoardInput, ListBoardsQuery, UpdateBoardInput } from '../validation/board.schemas.js';

export function newShareToken(): string {
  return randomBytes(24).toString('base64url');
}

async function loadBoardDto(boardId: string, userId: string): Promise<BoardDto> {
  const { access } = await loadBoardAccess(boardId, userId);
  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId }, include: boardInclude });
  return toBoardDto(board, access);
}

export async function listBoards(userId: string, q: ListBoardsQuery) {
  const ownedOrShared: Prisma.BoardWhereInput[] = [];
  if (q.role !== 'member') ownedOrShared.push({ ownerId: userId });
  if (q.role !== 'owner') ownedOrShared.push({ visibility: 'SHARED', members: { some: { userId } } });

  const where: Prisma.BoardWhereInput = {
    OR: ownedOrShared,
    ...(q.visibility && { visibility: q.visibility }),
    ...(q.search && {
      AND: [
        {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { description: { contains: q.search, mode: 'insensitive' } },
          ],
        },
      ],
    }),
  };

  const [boards, total] = await Promise.all([
    prisma.board.findMany({
      where,
      include: { ...boardInclude, members: { where: { userId }, select: { userId: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...toSkipTake(q.page, q.pageSize),
    }),
    prisma.board.count({ where }),
  ]);

  const items = boards.map(({ members, ...board }) => toBoardDto(board, computeAccess(board, userId, members.length > 0)));
  return paginated(items, total, q.page, q.pageSize);
}

export async function createBoard(userId: string, input: CreateBoardInput): Promise<BoardDto> {
  const board = await prisma.board.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      visibility: input.visibility,
      isOpen: input.visibility === 'SHARED' ? input.isOpen : false,
      shareToken: newShareToken(),
      ownerId: userId,
    },
    include: boardInclude,
  });
  return toBoardDto(board, computeAccess(board, userId, false));
}

export function getBoard(boardId: string, userId: string): Promise<BoardDto> {
  return loadBoardDto(boardId, userId);
}

export async function updateBoard(boardId: string, userId: string, input: UpdateBoardInput): Promise<BoardDto> {
  await prisma.$transaction(async (tx) => {
    const { board } = await requireBoardManage(boardId, userId, tx);
    const visibility = input.visibility ?? board.visibility;

    if (visibility === 'PRIVATE' && board.visibility === 'SHARED') {
      const memberCount = await tx.boardMember.count({ where: { boardId } });
      if (memberCount > 0) {
        throw new AppError(409, 'BOARD_HAS_MEMBERS', 'Remove all members before making the board private');
      }
    }

    await tx.board.update({
      where: { id: boardId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        visibility,
        isOpen: visibility === 'PRIVATE' ? false : (input.isOpen ?? board.isOpen),
      },
    });
  });
  return loadBoardDto(boardId, userId);
}

export async function deleteBoard(boardId: string, userId: string): Promise<void> {
  await requireBoardManage(boardId, userId);
  await prisma.board.delete({ where: { id: boardId } });
}

/** Creates a new share link; the previous link stops working. */
export async function regenerateShareLink(boardId: string, userId: string): Promise<BoardDto> {
  const { board } = await requireBoardManage(boardId, userId);
  if (board.visibility !== 'SHARED') {
    throw new AppError(400, 'BOARD_IS_PRIVATE', 'Only SHARED boards have a share link');
  }
  await prisma.board.update({ where: { id: boardId }, data: { shareToken: newShareToken() } });
  return loadBoardDto(boardId, userId);
}

/** A logged-in user who opens a share link becomes a member of the board. */
export async function joinByShareToken(shareToken: string, userId: string): Promise<BoardDto> {
  const board = await prisma.board.findUnique({ where: { shareToken } });
  if (!board || board.visibility !== 'SHARED') throw errors.boardNotFound();

  if (board.ownerId !== userId) {
    await prisma.boardMember.upsert({
      where: { boardId_userId: { boardId: board.id, userId } },
      create: { boardId: board.id, userId },
      update: {},
    });
  }
  return loadBoardDto(board.id, userId);
}
