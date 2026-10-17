import { describe, expect, it } from 'vitest';
import { api, createBoard, createSharedBoard, expectError, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();

describe('reminders', () => {
  it('full CRUD by the owner', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);

    const created = await api()
      .post(`/api/boards/${board.id}/reminders`)
      .set(dana.auth)
      .send({ title: 'Call mom', remindAt: '2030-03-04T18:00:00+02:00' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      boardId: board.id,
      title: 'Call mom',
      description: null,
      remindAt: '2030-03-04T16:00:00.000Z',
      audience: 'BOARD',
      createdBy: { id: dana.id },
      recipients: [],
    });
    const id = created.body.data.id;

    expect((await api().get(`/api/reminders/${id}`).set(dana.auth)).body.data.title).toBe('Call mom');

    const upd = await api().patch(`/api/reminders/${id}`).set(dana.auth).send({ title: 'Call dad', description: 'At 6' });
    expect(upd.body.data).toMatchObject({ title: 'Call dad', description: 'At 6' });

    expect((await api().delete(`/api/reminders/${id}`).set(dana.auth)).status).toBe(204);
    expectError(await api().get(`/api/reminders/${id}`).set(dana.auth), 404, 'REMINDER_NOT_FOUND');
  });

  it('validates input', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    expectError(await api().post(`/api/boards/${board.id}/reminders`).set(dana.auth).send({ title: 'x' }), 400, 'VALIDATION_ERROR');
    expectError(
      await api().post(`/api/boards/${board.id}/reminders`).set(dana.auth).send({ title: 'x', remindAt: '2030-03-04T10:00:00Z', audience: 'SELECTED' }),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('filters by from/to and search, sorted by remindAt', async () => {
    const dana = await registerUser('Dana');
    const board = await createBoard(dana);
    for (const [title, remindAt] of [
      ['March B', '2030-03-20T10:00:00Z'],
      ['March A', '2030-03-02T10:00:00Z'],
      ['April', '2030-04-02T10:00:00Z'],
    ]) {
      await api().post(`/api/boards/${board.id}/reminders`).set(dana.auth).send({ title, remindAt });
    }
    const march = await api().get(`/api/boards/${board.id}/reminders?from=2030-03-01T00:00:00Z&to=2030-04-01T00:00:00Z`).set(dana.auth);
    expect(march.body.data.items.map((r: { title: string }) => r.title)).toEqual(['March A', 'March B']);
    expect(march.body.data.pagination.total).toBe(2);

    const search = await api().get(`/api/boards/${board.id}/reminders?search=april`).set(dana.auth);
    expect(search.body.data.items).toHaveLength(1);
  });

  it('respects board permissions and SELECTED audience', async () => {
    const dana = await registerUser('Dana');
    const viewer = await registerUser('Viewer');
    const stranger = await registerUser('Stranger');
    const closed = await createSharedBoard(dana, [viewer], false);

    expectError(
      await api().post(`/api/boards/${closed.id}/reminders`).set(viewer.auth).send({ title: 'x', remindAt: '2030-03-04T10:00:00Z' }),
      403,
      'FORBIDDEN',
    );
    expectError(await api().get(`/api/boards/${closed.id}/reminders`).set(stranger.auth), 404, 'BOARD_NOT_FOUND');

    const secret = await api()
      .post(`/api/boards/${closed.id}/reminders`)
      .set(dana.auth)
      .send({ title: 'Only me', remindAt: '2030-03-04T10:00:00Z', audience: 'SELECTED', recipientIds: [dana.id] });
    const shared = await api()
      .post(`/api/boards/${closed.id}/reminders`)
      .set(dana.auth)
      .send({ title: 'Everyone', remindAt: '2030-03-04T11:00:00Z' });

    const list = await api().get(`/api/boards/${closed.id}/reminders`).set(viewer.auth);
    expect(list.body.data.items.map((r: { title: string }) => r.title)).toEqual(['Everyone']);
    expectError(await api().get(`/api/reminders/${secret.body.data.id}`).set(viewer.auth), 404, 'REMINDER_NOT_FOUND');
    expectError(await api().patch(`/api/reminders/${shared.body.data.id}`).set(viewer.auth).send({ title: 'x' }), 403, 'FORBIDDEN');
    expectError(await api().delete(`/api/reminders/${shared.body.data.id}`).set(viewer.auth), 403, 'FORBIDDEN');
  });
});
