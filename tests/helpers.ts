import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

const server: Server = createServer(createApp()).listen(0);

/** supertest agent bound to one in-process HTTP server (supports truly parallel requests). */
export const api = () => request(server);

export const PASSWORD = 'Passw0rd!';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
  auth: { Authorization: string };
}

let counter = 0;

export async function registerUser(name = 'User'): Promise<TestUser> {
  counter += 1;
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}.${counter}@test.example`;
  const res = await api().post('/api/auth/register').send({ email, password: PASSWORD, name });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token: string = res.body.data.accessToken;
  return { id: res.body.data.user.id, email, name, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function createBoard(owner: TestUser, body: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/boards')
    .set(owner.auth)
    .send({ name: 'Board', ...body });
  if (res.status !== 201) throw new Error(`create board failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; shareToken: string | null; [k: string]: unknown };
}

/** SHARED board with the given members already joined. */
export async function createSharedBoard(owner: TestUser, members: TestUser[], isOpen: boolean) {
  const board = await createBoard(owner, { name: isOpen ? 'Open board' : 'Closed board', visibility: 'SHARED', isOpen });
  for (const m of members) {
    const res = await api().post(`/api/boards/${board.id}/members`).set(owner.auth).send({ email: m.email });
    if (res.status !== 201) throw new Error(`add member failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return board;
}

export async function createTask(user: TestUser, boardId: string, body: Record<string, unknown>) {
  return api().post(`/api/boards/${boardId}/tasks`).set(user.auth).send({ title: 'Task', ...body });
}

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "reminder_recipients", "reminders", "task_assignments", "tasks", "board_members", "boards", "sessions", "users" CASCADE',
  );
}

/** Register in a test file to start every test with an empty database. */
export function useCleanDatabase() {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => (server.listening ? server.close(() => resolve()) : resolve()));
    await prisma.$disconnect();
  });
}

export const expectError = (res: request.Response, status: number, code: string) => {
  if (res.status !== status || res.body?.error?.code !== code) {
    throw new Error(`Expected ${status} ${code}, got ${res.status} ${JSON.stringify(res.body)}`);
  }
  if (res.body.success !== false || typeof res.body.error.message !== 'string') {
    throw new Error(`Error envelope is wrong: ${JSON.stringify(res.body)}`);
  }
};
