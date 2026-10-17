import type { Request, Response } from 'express';
import * as boardService from '../services/board.service.js';
import * as memberService from '../services/member.service.js';
import { requireAuth } from '../middleware/authenticate.js';
import { sendData, sendNoContent } from '../utils/response.js';
import { boardIdParams, memberParams } from '../validation/common.js';
import {
  addMemberSchema,
  createBoardSchema,
  listBoardsQuery,
  shareTokenParams,
  updateBoardSchema,
} from '../validation/board.schemas.js';

export async function list(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  sendData(res, await boardService.listBoards(userId, listBoardsQuery.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  sendData(res, await boardService.createBoard(userId, createBoardSchema.parse(req.body)), 201);
}

export async function get(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await boardService.getBoard(boardId, userId));
}

export async function update(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await boardService.updateBoard(boardId, userId, updateBoardSchema.parse(req.body)));
}

export async function remove(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  await boardService.deleteBoard(boardId, userId);
  sendNoContent(res);
}

export async function regenerateShareLink(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await boardService.regenerateShareLink(boardId, userId));
}

export async function join(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { shareToken } = shareTokenParams.parse(req.params);
  sendData(res, await boardService.joinByShareToken(shareToken, userId));
}

export async function listMembers(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  sendData(res, await memberService.listMembers(boardId, userId));
}

export async function addMember(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const { boardId } = boardIdParams.parse(req.params);
  const { email } = addMemberSchema.parse(req.body);
  sendData(res, await memberService.addMember(boardId, userId, email), 201);
}

export async function removeMember(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  const params = memberParams.parse(req.params);
  await memberService.removeMember(params.boardId, userId, params.userId);
  sendNoContent(res);
}
