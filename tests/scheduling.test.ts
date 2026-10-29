import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { api, createBoard, createSharedBoard, createTask, expectError, registerUser, useCleanDatabase, type TestUser } from './helpers.js';

useCleanDatabase();

const DAY = '2030-03-04';
const t = (hhmm: string) => `${DAY}T${hhmm}:00.000Z`;

async function suggest(user: TestUser, boardId: string, body: Record<string, unknown>) {
  return api().post(`/api/boards/${boardId}/scheduling/suggestions`).set(user.auth).send(body);
}

describe('POST /api/boards/:boardId/scheduling/suggestions', () => {
  it('finds free windows around busy tasks, earliest first, default 3', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    await createTask(dana, board.id, { startAt: t('09:00'), endAt: t('10:30') });
    await createTask(dana, board.id, { startAt: t('11:00'), endAt: t('12:00') });

    const res = await suggest(dana, board.id, { durationMinutes: 60, from: t('08:00'), to: t('16:00') });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        suggestions: [
          { startAt: t('08:00'), endAt: t('09:00') },
          { startAt: t('12:00'), endAt: t('13:00') }, // 10:30-11:00 is too short
          { startAt: t('13:00'), endAt: t('14:00') },
        ],
      },
    });
  });

  it('respects maxSuggestions and only searches inside the requested range', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    const res = await suggest(dana, board.id, { durationMinutes: 30, from: t('08:00'), to: t('09:15'), maxSuggestions: 10 });
    expect(res.body.data.suggestions).toEqual([
      { startAt: t('08:00'), endAt: t('08:30') },
      { startAt: t('08:30'), endAt: t('09:00') },
    ]);
  });

  it('returns an empty array when the whole range is busy', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    await createTask(dana, board.id, { startAt: t('07:00'), endAt: t('12:00') });
    await createTask(dana, board.id, { startAt: t('12:00'), endAt: t('18:00') });
    const res = await suggest(dana, board.id, { durationMinutes: 30, from: t('08:00'), to: t('17:00') });
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toEqual([]);
  });

  it('ignores reminders, date-only tasks, unscheduled tasks and DONE tasks', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    await api().post(`/api/boards/${board.id}/reminders`).set(dana.auth).send({ title: 'R', remindAt: t('08:15') });
    await createTask(dana, board.id, { dueDate: DAY });
    await createTask(dana, board.id, { title: 'no date' });
    await createTask(dana, board.id, { startAt: t('08:00'), endAt: t('10:00'), status: 'DONE' });

    const res = await suggest(dana, board.id, { durationMinutes: 120, from: t('08:00'), to: t('10:00') });
    expect(res.body.data.suggestions).toEqual([{ startAt: t('08:00'), endAt: t('10:00') }]);
  });

  it("uses the target user's tasks on THIS board only", async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createSharedBoard(dana, [noa], true);
    const noasOwnBoard = await createBoard(noa);
    await createTask(noa, noasOwnBoard.id, { startAt: t('08:00'), endAt: t('09:00') }); // other board – ignored
    await createTask(dana, board.id, { startAt: t('09:00'), endAt: t('10:00'), assigneeIds: [noa.id] }); // this board – busy

    const forNoa = await suggest(dana, board.id, { durationMinutes: 60, from: t('08:00'), to: t('10:00'), assignedUserId: noa.id });
    expect(forNoa.body.data.suggestions).toEqual([{ startAt: t('08:00'), endAt: t('09:00') }]);

    const forDana = await suggest(dana, board.id, { durationMinutes: 60, from: t('08:00'), to: t('10:00'), maxSuggestions: 1 });
    expect(forDana.body.data.suggestions).toEqual([{ startAt: t('08:00'), endAt: t('09:00') }]);
  });

  it('the target user must belong to the board; the caller must see the board', async () => {
    const dana = await registerUser('Dana');
    const stranger = await registerUser('Stranger');
    const board = await createBoard(dana, { visibility: 'SHARED' });
    expectError(await suggest(dana, board.id, { durationMinutes: 30, from: t('08:00'), to: t('10:00'), assignedUserId: stranger.id }), 400, 'NOT_A_BOARD_MEMBER');
    expectError(await suggest(stranger, board.id, { durationMinutes: 30, from: t('08:00'), to: t('10:00') }), 404, 'BOARD_NOT_FOUND');
  });

  it('validates the request', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    for (const body of [
      { durationMinutes: 0, from: t('08:00'), to: t('10:00') },
      { durationMinutes: 1.5, from: t('08:00'), to: t('10:00') },
      { durationMinutes: 30, from: t('10:00'), to: t('08:00') },
      { durationMinutes: 30, from: 'tomorrow', to: t('08:00') },
      { durationMinutes: 30, from: t('08:00'), to: t('10:00'), maxSuggestions: 0 },
    ]) {
      expectError(await suggest(dana, board.id, body), 400, 'VALIDATION_ERROR');
    }
  });

  it('does not save anything', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    const before = await prisma.task.count();
    await suggest(dana, board.id, { durationMinutes: 30, from: t('08:00'), to: t('10:00') });
    expect(await prisma.task.count()).toBe(before);
  });

  it('a chosen suggestion can be saved, and then it is no longer suggested', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    const first = await suggest(dana, board.id, { durationMinutes: 90, from: t('09:00'), to: t('12:00'), maxSuggestions: 1 });
    const chosen = first.body.data.suggestions[0];
    expect((await createTask(dana, board.id, { title: 'Chosen', ...chosen })).status).toBe(201);

    const again = await suggest(dana, board.id, { durationMinutes: 90, from: t('09:00'), to: t('12:00') });
    expect(again.body.data.suggestions).toEqual([{ startAt: t('10:30'), endAt: t('12:00') }]);
    expectError(await createTask(dana, board.id, { title: 'Same slot', ...chosen }), 409, 'TIME_CONFLICT');
  });
});
