import { z } from 'zod';
import { description, paginationQuery } from './common.js';
import { emailSchema } from './auth.schemas.js';

const visibility = z.enum(['PRIVATE', 'SHARED']);
const name = z.string().trim().min(1, 'Name is required').max(100);

export const createBoardSchema = z.object({
  name,
  description: description.optional(),
  visibility: visibility.default('PRIVATE'),
  isOpen: z.boolean().default(false),
});

export const updateBoardSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    visibility: visibility.optional(),
    isOpen: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Send at least one field to update' });

export const listBoardsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  visibility: visibility.optional(),
  /** owner = boards I created, member = boards shared with me */
  role: z.enum(['owner', 'member']).optional(),
  ...paginationQuery,
});

export const shareTokenParams = z.object({ shareToken: z.string().min(10).max(100) });

export const addMemberSchema = z.object({ email: emailSchema });

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type ListBoardsQuery = z.infer<typeof listBoardsQuery>;
