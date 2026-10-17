import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { api, createBoard, createSharedBoard, createTask, expectError, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();

describe('board members', () => {
  it('owner adds a member by email; duplicates and invalid cases are rejected', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createBoard(dana, { visibility: 'SHARED' });

    const add = await api().post(`/api/boards/${board.id}/members`).set(dana.auth).send({ email: noa.email.toUpperCase() });
    expect(add.status).toBe(201);
    expect(add.body.data).toMatchObject({ user: { id: noa.id, email: noa.email }, isOwner: false });

    expectError(await api().post(`/api/boards/${board.id}/members`).set(dana.auth).send({ email: noa.email }), 409, 'ALREADY_MEMBER');
    expectError(await api().post(`/api/boards/${board.id}/members`).set(dana.auth).send({ email: dana.email }), 409, 'CANNOT_ADD_OWNER');
    expectError(await api().post(`/api/boards/${board.id}/members`).set(dana.auth).send({ email: 'ghost@test.example' }), 404, 'USER_NOT_FOUND');
    expectError(await api().post(`/api/boards/${board.id}/members`).set(dana.auth).send({ email: 'bad' }), 400, 'VALIDATION_ERROR');

    const list = await api().get(`/api/boards/${board.id}/members`).set(noa.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.map((m: { user: { id: string }; isOwner: boolean }) => [m.user.id, m.isOwner])).toEqual([
      [dana.id, true],
      [noa.id, false],
    ]);
  });

  it('members cannot be added to a PRIVATE board', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createBoard(dana);
    expectError(await api().post(`/api/boards/${board.id}/members`).set(dana.auth).send({ email: noa.email }), 400, 'BOARD_IS_PRIVATE');
  });

  it('only the owner manages members', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const yael = await registerUser('Yael');
    const board = await createSharedBoard(dana, [noa], true);
    expectError(await api().post(`/api/boards/${board.id}/members`).set(noa.auth).send({ email: yael.email }), 403, 'FORBIDDEN');
    expectError(await api().delete(`/api/boards/${board.id}/members/${dana.id}`).set(noa.auth), 403, 'FORBIDDEN');
  });

  it('the owner cannot be removed', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana, { visibility: 'SHARED' });
    expectError(await api().delete(`/api/boards/${board.id}/members/${dana.id}`).set(dana.auth), 400, 'CANNOT_REMOVE_OWNER');
  });

  it('removing a member keeps their tasks, drops their assignments and revokes their access', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createSharedBoard(dana, [noa], true);

    const noasTask = await createTask(noa, board.id, { title: 'Created by Noa' });
    expect(noasTask.status).toBe(201);
    const assigned = await createTask(dana, board.id, { title: 'Assigned to both', assigneeIds: [dana.id, noa.id] });
    const reminder = await api()
      .post(`/api/boards/${board.id}/reminders`)
      .set(dana.auth)
      .send({ title: 'For Noa', remindAt: '2030-01-01T10:00:00Z', audience: 'SELECTED', recipientIds: [noa.id] });
    expect(reminder.status).toBe(201);

    // a task on ANOTHER board assigned to Noa must not be touched
    const other = await createSharedBoard(dana, [noa], true);
    const otherTask = await createTask(dana, other.id, { title: 'Other board', assigneeIds: [noa.id] });

    const del = await api().delete(`/api/boards/${board.id}/members/${noa.id}`).set(dana.auth);
    expect(del.status).toBe(204);

    // Noa's task stays on the board
    const kept = await api().get(`/api/tasks/${noasTask.body.data.id}`).set(dana.auth);
    expect(kept.status).toBe(200);
    expect(kept.body.data.createdBy.id).toBe(noa.id);

    // Noa is no longer an assignee here
    const t = await api().get(`/api/tasks/${assigned.body.data.id}`).set(dana.auth);
    expect(t.body.data.assignees.map((a: { id: string }) => a.id)).toEqual([dana.id]);
    expect(await prisma.reminderRecipient.count({ where: { reminderId: reminder.body.data.id } })).toBe(0);

    // ...but still on the other board
    expect(await prisma.taskAssignment.count({ where: { taskId: otherTask.body.data.id, userId: noa.id } })).toBe(1);

    // Noa lost access
    expectError(await api().get(`/api/boards/${board.id}`).set(noa.auth), 404, 'BOARD_NOT_FOUND');
    expectError(await createTask(noa, board.id, { title: 'nope' }), 404, 'BOARD_NOT_FOUND');

    // removing again -> 404
    expectError(await api().delete(`/api/boards/${board.id}/members/${noa.id}`).set(dana.auth), 404, 'MEMBER_NOT_FOUND');
  });
});
