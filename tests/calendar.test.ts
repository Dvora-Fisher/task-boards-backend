import { describe, expect, it } from 'vitest';
import { api, createBoard, createSharedBoard, createTask, expectError, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();

describe('GET /api/boards/:boardId/calendar', () => {
  it('returns timed tasks, all-day tasks and reminders in one sorted list', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    await createTask(dana, board.id, { title: 'Meeting', startAt: '2030-03-04T09:00:00Z', endAt: '2030-03-04T10:00:00Z' });
    await createTask(dana, board.id, { title: 'Done meeting', status: 'DONE', startAt: '2030-03-04T11:00:00Z', endAt: '2030-03-04T12:00:00Z' });
    await createTask(dana, board.id, { title: 'Deadline', dueDate: '2030-03-04' });
    await createTask(dana, board.id, { title: 'No date' });
    await createTask(dana, board.id, { title: 'Next month', dueDate: '2030-04-04' });
    await api().post(`/api/boards/${board.id}/reminders`).set(dana.auth).send({ title: 'Call', remindAt: '2030-03-04T09:30:00Z' });

    const res = await api().get(`/api/boards/${board.id}/calendar?from=2030-03-01T00:00:00Z&to=2030-04-01T00:00:00Z`).set(dana.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.from).toBe('2030-03-01T00:00:00.000Z');

    const events = res.body.data.events;
    expect(events.map((e: { title: string }) => e.title)).toEqual(['Deadline', 'Meeting', 'Call', 'Done meeting']);
    expect(events[0]).toMatchObject({ type: 'TASK', allDay: true, date: '2030-03-04', startAt: null, endAt: null, blocksTime: false });
    expect(events[1]).toMatchObject({ type: 'TASK', allDay: false, startAt: '2030-03-04T09:00:00.000Z', endAt: '2030-03-04T10:00:00.000Z', blocksTime: true, status: 'TODO' });
    expect(events[2]).toMatchObject({ type: 'REMINDER', allDay: false, startAt: '2030-03-04T09:30:00.000Z', endAt: null, blocksTime: false, status: null, priority: null });
    expect(events[3]).toMatchObject({ type: 'TASK', blocksTime: false, status: 'DONE' });
  });

  it('includes a timed task that only partly overlaps the range', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    await createTask(dana, board.id, { title: 'Overnight', startAt: '2030-03-31T22:00:00Z', endAt: '2030-04-01T02:00:00Z' });
    const res = await api().get(`/api/boards/${board.id}/calendar?from=2030-04-01T00:00:00Z&to=2030-04-02T00:00:00Z`).set(dana.auth);
    expect(res.body.data.events).toHaveLength(1);
  });

  it('hides SELECTED items from other members', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createSharedBoard(dana, [noa], true);
    await createTask(dana, board.id, { title: 'Mine', dueDate: '2030-03-04', audience: 'SELECTED', assigneeIds: [dana.id] });
    const res = await api().get(`/api/boards/${board.id}/calendar?from=2030-03-01T00:00:00Z&to=2030-04-01T00:00:00Z`).set(noa.auth);
    expect(res.body.data.events).toHaveLength(0);
  });

  it('validates from/to and permissions', async () => {
    const dana = await registerUser('Dana');
    const stranger = await registerUser('Stranger');
    const board = await createBoard(dana);
    const base = `/api/boards/${board.id}/calendar`;
    expectError(await api().get(base).set(dana.auth), 400, 'VALIDATION_ERROR');
    expectError(await api().get(`${base}?from=yesterday&to=2030-03-01T00:00:00Z`).set(dana.auth), 400, 'VALIDATION_ERROR');
    expectError(await api().get(`${base}?from=2030-03-02T00:00:00Z&to=2030-03-01T00:00:00Z`).set(dana.auth), 400, 'VALIDATION_ERROR');
    expectError(await api().get(`${base}?from=2030-01-01T00:00:00Z&to=2032-01-01T00:00:00Z`).set(dana.auth), 400, 'VALIDATION_ERROR');
    expectError(await api().get(`${base}?from=2030-03-01T00:00:00Z&to=2030-04-01T00:00:00Z`).set(stranger.auth), 404, 'BOARD_NOT_FOUND');
  });
});
