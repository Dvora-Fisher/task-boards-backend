import { describe, expect, it } from 'vitest';
import { api, createBoard, createSharedBoard, createTask, expectError, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();

const slot = (startH: number, startM: number, endH: number, endM: number, day = '2030-03-04') => ({
  startAt: `${day}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00Z`,
  endAt: `${day}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00Z`,
});

describe('task permissions', () => {
  it('a user without access cannot create a task (404 — board is hidden)', async () => {
    const dana = await registerUser('Dana');
    const stranger = await registerUser('Stranger');
    const shared = await createBoard(dana, { visibility: 'SHARED', isOpen: true });
    const priv = await createBoard(dana);
    expectError(await createTask(stranger, shared.id, { title: 'x' }), 404, 'BOARD_NOT_FOUND');
    expectError(await createTask(stranger, priv.id, { title: 'x' }), 404, 'BOARD_NOT_FOUND');
  });

  it('no token -> 401', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    expectError(await api().post(`/api/boards/${board.id}/tasks`).send({ title: 'x' }), 401, 'UNAUTHORIZED');
  });

  it('a viewer (member of a CLOSED board) can read but cannot create, edit or delete (403)', async () => {
    const dana = await registerUser('Dana');
    const viewer = await registerUser('Viewer');
    const board = await createSharedBoard(dana, [viewer], false);
    const task = await createTask(dana, board.id, { title: 'Owner task' });
    expect(task.status).toBe(201);

    expect((await api().get(`/api/boards/${board.id}/tasks`).set(viewer.auth)).body.data.items).toHaveLength(1);
    expect((await api().get(`/api/tasks/${task.body.data.id}`).set(viewer.auth)).status).toBe(200);

    expectError(await createTask(viewer, board.id, { title: 'nope' }), 403, 'FORBIDDEN');
    expectError(await api().patch(`/api/tasks/${task.body.data.id}`).set(viewer.auth).send({ status: 'DONE' }), 403, 'FORBIDDEN');
    expectError(await api().delete(`/api/tasks/${task.body.data.id}`).set(viewer.auth), 403, 'FORBIDDEN');
  });

  it('a member of an OPEN board can create, edit and delete any visible task', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createSharedBoard(dana, [noa], true);
    const ownerTask = await createTask(dana, board.id, { title: 'Owner task' });

    const created = await createTask(noa, board.id, { title: 'Noa task', priority: 'HIGH' });
    expect(created.status).toBe(201);
    expect(created.body.data.createdBy.id).toBe(noa.id);

    const upd = await api().patch(`/api/tasks/${ownerTask.body.data.id}`).set(noa.auth).send({ status: 'IN_PROGRESS' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.status).toBe('IN_PROGRESS');

    expect((await api().delete(`/api/tasks/${ownerTask.body.data.id}`).set(noa.auth)).status).toBe(204);
    expectError(await api().get(`/api/tasks/${ownerTask.body.data.id}`).set(dana.auth), 404, 'TASK_NOT_FOUND');
  });

  it('assignees must belong to the board', async () => {
    const dana = await registerUser('Dana');
    const stranger = await registerUser('Stranger');
    const board = await createBoard(dana, { visibility: 'SHARED' });
    expectError(await createTask(dana, board.id, { assigneeIds: [stranger.id] }), 400, 'NOT_A_BOARD_MEMBER');
  });
});

describe('task CRUD and validation', () => {
  it('creates unscheduled, date-only and timed tasks with the documented shape', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);

    const none = await createTask(dana, board.id, { title: 'No date', description: 'desc' });
    expect(none.status).toBe(201);
    expect(none.body.data).toMatchObject({
      boardId: board.id,
      title: 'No date',
      description: 'desc',
      status: 'TODO',
      priority: 'MEDIUM',
      audience: 'BOARD',
      scheduleType: 'NONE',
      dueDate: null,
      startAt: null,
      endAt: null,
      createdBy: { id: dana.id },
      assignees: [],
    });

    const dated = await createTask(dana, board.id, { title: 'Due', dueDate: '2030-03-04' });
    expect(dated.body.data).toMatchObject({ scheduleType: 'DATE', dueDate: '2030-03-04', startAt: null });

    const timed = await createTask(dana, board.id, { title: 'Timed', startAt: '2030-03-04T11:00:00+02:00', endAt: '2030-03-04T12:30:00+02:00' });
    expect(timed.body.data).toMatchObject({
      scheduleType: 'TIMED',
      startAt: '2030-03-04T09:00:00.000Z', // stored and returned in UTC
      endAt: '2030-03-04T10:30:00.000Z',
    });
  });

  it('allows many tasks on the same day', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    for (let i = 0; i < 3; i++) expect((await createTask(dana, board.id, { dueDate: '2030-03-04' })).status).toBe(201);
    expect((await createTask(dana, board.id, slot(8, 0, 9, 0))).status).toBe(201);
    expect((await createTask(dana, board.id, slot(9, 0, 10, 0))).status).toBe(201); // touching, not overlapping
  });

  it('rejects invalid schedules', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    expectError(await createTask(dana, board.id, { title: '' }), 400, 'VALIDATION_ERROR');
    expectError(await createTask(dana, board.id, { startAt: '2030-03-04T09:00:00Z' }), 400, 'VALIDATION_ERROR');
    expectError(await createTask(dana, board.id, slot(10, 0, 9, 0)), 400, 'VALIDATION_ERROR');
    expectError(await createTask(dana, board.id, { dueDate: '2030-03-04', ...slot(9, 0, 10, 0) }), 400, 'VALIDATION_ERROR');
    expectError(await createTask(dana, board.id, { startAt: '2030-03-04T09:00:00', endAt: '2030-03-04T10:00:00' }), 400, 'VALIDATION_ERROR'); // no timezone
    expectError(await createTask(dana, board.id, { dueDate: '04/03/2030' }), 400, 'VALIDATION_ERROR');
    expectError(await createTask(dana, board.id, { status: 'FINISHED' }), 400, 'VALIDATION_ERROR');
    expectError(await createTask(dana, board.id, { audience: 'SELECTED' }), 400, 'VALIDATION_ERROR');
  });

  it('PATCH switches between schedule types and can clear them', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    const t = await createTask(dana, board.id, { dueDate: '2030-03-04' });
    const id = t.body.data.id;

    const toTimed = await api().patch(`/api/tasks/${id}`).set(dana.auth).send(slot(9, 0, 10, 0));
    expect(toTimed.body.data).toMatchObject({ scheduleType: 'TIMED', dueDate: null });

    const toDate = await api().patch(`/api/tasks/${id}`).set(dana.auth).send({ dueDate: '2030-03-05' });
    expect(toDate.body.data).toMatchObject({ scheduleType: 'DATE', dueDate: '2030-03-05', startAt: null, endAt: null });

    const cleared = await api().patch(`/api/tasks/${id}`).set(dana.auth).send({ dueDate: null, description: null });
    expect(cleared.body.data).toMatchObject({ scheduleType: 'NONE', description: null });

    expectError(await api().patch(`/api/tasks/${id}`).set(dana.auth).send({}), 400, 'VALIDATION_ERROR');
    expectError(await api().patch(`/api/tasks/${id}`).set(dana.auth).send({ startAt: '2030-03-04T09:00:00Z' }), 400, 'VALIDATION_ERROR');
  });
});

describe('private (SELECTED) tasks', () => {
  it('are visible only to the creator and selected users — not even to the board owner', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const yael = await registerUser('Yael');
    const board = await createSharedBoard(dana, [noa, yael], true);

    const secret = await createTask(noa, board.id, { title: 'Secret', audience: 'SELECTED', assigneeIds: [yael.id] });
    expect(secret.status).toBe(201);
    await createTask(dana, board.id, { title: 'Public' });

    const titles = async (u: typeof dana) =>
      (await api().get(`/api/boards/${board.id}/tasks`).set(u.auth)).body.data.items.map((t: { title: string }) => t.title).sort();

    expect(await titles(noa)).toEqual(['Public', 'Secret']);
    expect(await titles(yael)).toEqual(['Public', 'Secret']);
    expect(await titles(dana)).toEqual(['Public']);
    expectError(await api().get(`/api/tasks/${secret.body.data.id}`).set(dana.auth), 404, 'TASK_NOT_FOUND');
    expectError(await api().delete(`/api/tasks/${secret.body.data.id}`).set(dana.auth), 404, 'TASK_NOT_FOUND');
  });
});

describe('GET /api/boards/:boardId/tasks — filters', () => {
  it('filters by status, priority, schedule, search, date range and assignee', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createSharedBoard(dana, [noa], true);
    await createTask(dana, board.id, { title: 'Buy paint', priority: 'LOW' });
    await createTask(dana, board.id, { title: 'Write report', status: 'DONE', priority: 'HIGH', dueDate: '2030-03-04' });
    await createTask(dana, board.id, { title: 'Meeting', status: 'IN_PROGRESS', priority: 'HIGH', ...slot(9, 0, 10, 0), assigneeIds: [noa.id] });
    await createTask(dana, board.id, { title: 'Later meeting', ...slot(9, 0, 10, 0, '2030-04-10') });

    const q = async (qs: string) => {
      const res = await api().get(`/api/boards/${board.id}/tasks?${qs}`).set(noa.auth);
      expect(res.status).toBe(200);
      return res.body.data.items.map((t: { title: string }) => t.title).sort();
    };

    expect(await q('status=DONE')).toEqual(['Write report']);
    expect(await q('status=TODO,IN_PROGRESS')).toEqual(['Buy paint', 'Later meeting', 'Meeting']);
    expect(await q('priority=HIGH')).toEqual(['Meeting', 'Write report']);
    expect(await q('schedule=NONE')).toEqual(['Buy paint']);
    expect(await q('schedule=DATE')).toEqual(['Write report']);
    expect(await q('schedule=TIMED')).toEqual(['Later meeting', 'Meeting']);
    expect(await q('search=MEET')).toEqual(['Later meeting', 'Meeting']);
    expect(await q('from=2030-03-01T00:00:00Z&to=2030-03-31T00:00:00Z')).toEqual(['Meeting', 'Write report']);
    expect(await q('assignedToMe=true')).toEqual(['Meeting']);
    expect(await q('sort=title&order=asc&pageSize=2')).toEqual(['Buy paint', 'Later meeting']);

    const res = await api().get(`/api/boards/${board.id}/tasks?status=WRONG`).set(noa.auth);
    expectError(res, 400, 'VALIDATION_ERROR');
  });
});

describe('time conflicts', () => {
  it('rejects a task in a time that is already taken (409 TIME_CONFLICT)', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    expect((await createTask(dana, board.id, slot(9, 0, 10, 30))).status).toBe(201);

    const res = await createTask(dana, board.id, slot(10, 0, 11, 0));
    expectError(res, 409, 'TIME_CONFLICT');
    expect(res.body.error.details.conflicts).toEqual([{ startAt: '2030-03-04T09:00:00.000Z', endAt: '2030-03-04T10:30:00.000Z' }]);
  });

  it('checks the assignees on the SAME board only, and other users are not blocked', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const boardA = await createSharedBoard(dana, [noa], true);
    const boardB = await createSharedBoard(noa, [dana], true);

    expect((await createTask(dana, boardA.id, { ...slot(9, 0, 10, 0), assigneeIds: [noa.id] })).status).toBe(201);
    expectError(await createTask(noa, boardA.id, slot(9, 30, 10, 30)), 409, 'TIME_CONFLICT'); // noa busy on board A
    expect((await createTask(noa, boardB.id, slot(9, 30, 10, 30))).status).toBe(201); // board B is a separate calendar
    expect((await createTask(dana, boardA.id, { ...slot(9, 30, 10, 30), assigneeIds: [dana.id] })).status).toBe(201); // dana is free
  });

  it('date-only tasks, DONE tasks and reminders never cause conflicts', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    await createTask(dana, board.id, { dueDate: '2030-03-04' });
    await createTask(dana, board.id, { ...slot(9, 0, 10, 0), status: 'DONE' });
    await api().post(`/api/boards/${board.id}/reminders`).set(dana.auth).send({ title: 'R', remindAt: '2030-03-04T09:30:00Z' });

    expect((await createTask(dana, board.id, slot(9, 0, 10, 0))).status).toBe(201);
  });

  it('re-checks on update: moving or re-opening a task into a taken slot is rejected', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    await createTask(dana, board.id, slot(9, 0, 10, 0));
    const other = await createTask(dana, board.id, slot(11, 0, 12, 0));
    const done = await createTask(dana, board.id, { ...slot(9, 30, 10, 30), status: 'DONE' });

    expectError(await api().patch(`/api/tasks/${other.body.data.id}`).set(dana.auth).send(slot(9, 45, 10, 15)), 409, 'TIME_CONFLICT');
    expectError(await api().patch(`/api/tasks/${done.body.data.id}`).set(dana.auth).send({ status: 'TODO' }), 409, 'TIME_CONFLICT');

    // editing a task without touching its time does not conflict with itself
    expect((await api().patch(`/api/tasks/${other.body.data.id}`).set(dana.auth).send({ ...slot(11, 0, 12, 30), title: 'Longer' })).status).toBe(200);
  });

  it('two parallel requests for overlapping times: exactly one succeeds', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);

    for (let round = 0; round < 3; round++) {
      const day = `2030-05-0${round + 1}`;
      const results = await Promise.all([
        createTask(dana, board.id, { title: 'A', ...slot(9, 0, 10, 0, day) }),
        createTask(dana, board.id, { title: 'B', ...slot(9, 30, 10, 30, day) }),
      ]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.error.code).toBe('TIME_CONFLICT');
    }

    const list = await api().get(`/api/boards/${board.id}/tasks?schedule=TIMED`).set(dana.auth);
    expect(list.body.data.pagination.total).toBe(3);
  });
});
