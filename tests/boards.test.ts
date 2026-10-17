import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { api, createBoard, createSharedBoard, expectError, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();

describe('boards CRUD', () => {
  it('creates a private board owned by the caller', async () => {
    const dana = await registerUser('Dana');
    const res = await api().post('/api/boards').set(dana.auth).send({ name: 'Home', description: 'My stuff', isOpen: true });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Home',
      description: 'My stuff',
      visibility: 'PRIVATE',
      isOpen: false, // ignored for PRIVATE
      owner: { id: dana.id },
      memberCount: 0,
      shareToken: null,
      myAccess: { isOwner: true, canView: true, canEdit: true, canManage: true },
    });
  });

  it('validates the body', async () => {
    const dana = await registerUser('Dana');
    expectError(await api().post('/api/boards').set(dana.auth).send({ name: '', visibility: 'PUBLIC' }), 400, 'VALIDATION_ERROR');
  });

  it('owner can update and delete; non-owner member gets 403', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createSharedBoard(dana, [noa], true);

    expectError(await api().patch(`/api/boards/${board.id}`).set(noa.auth).send({ name: 'Hack' }), 403, 'FORBIDDEN');
    expectError(await api().delete(`/api/boards/${board.id}`).set(noa.auth), 403, 'FORBIDDEN');

    const upd = await api().patch(`/api/boards/${board.id}`).set(dana.auth).send({ name: 'Renamed', isOpen: false });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ name: 'Renamed', isOpen: false });

    expect((await api().delete(`/api/boards/${board.id}`).set(dana.auth)).status).toBe(204);
    expectError(await api().get(`/api/boards/${board.id}`).set(dana.auth), 404, 'BOARD_NOT_FOUND');
  });

  it('cannot turn a SHARED board with members into PRIVATE (409 BOARD_HAS_MEMBERS)', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createSharedBoard(dana, [noa], true);
    expectError(await api().patch(`/api/boards/${board.id}`).set(dana.auth).send({ visibility: 'PRIVATE' }), 409, 'BOARD_HAS_MEMBERS');
  });

  it('rejects a non-UUID id with 400', async () => {
    const dana = await registerUser('Dana');
    expectError(await api().get('/api/boards/not-a-uuid').set(dana.auth), 400, 'VALIDATION_ERROR');
  });
});

describe('board privacy', () => {
  it('a private board is invisible to other users (404, not 403)', async () => {
    const dana = await registerUser('Dana');
    const stranger = await registerUser('Stranger');
    const board = await createBoard(dana, { name: 'Secret' });

    expectError(await api().get(`/api/boards/${board.id}`).set(stranger.auth), 404, 'BOARD_NOT_FOUND');
    expectError(await api().get(`/api/boards/${board.id}/tasks`).set(stranger.auth), 404, 'BOARD_NOT_FOUND');
    expectError(await api().patch(`/api/boards/${board.id}`).set(stranger.auth).send({ name: 'x' }), 404, 'BOARD_NOT_FOUND');

    const list = await api().get('/api/boards').set(stranger.auth);
    expect(list.body.data.items).toHaveLength(0);
  });

  it('a private board cannot be joined with its token', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const board = await createBoard(dana);
    const { shareToken: token } = await prisma.board.findUniqueOrThrow({ where: { id: board.id } });
    expectError(await api().post(`/api/boards/join/${token}`).set(noa.auth), 404, 'BOARD_NOT_FOUND');
  });
});

describe('share links', () => {
  it('a logged-in user with the link joins the board; old links stop working after regenerate', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const yael = await registerUser('Yael');
    const board = await createBoard(dana, { visibility: 'SHARED', isOpen: true });
    expect(board.shareToken).toBeTruthy();

    // not logged in -> 401
    expectError(await api().post(`/api/boards/join/${board.shareToken}`), 401, 'UNAUTHORIZED');

    const joined = await api().post(`/api/boards/join/${board.shareToken}`).set(noa.auth);
    expect(joined.status).toBe(200);
    expect(joined.body.data.myAccess).toEqual({ isOwner: false, isMember: true, canView: true, canEdit: true, canManage: false });
    expect(joined.body.data.shareToken).toBeNull(); // only the owner sees the token

    // joining twice is harmless
    expect((await api().post(`/api/boards/join/${board.shareToken}`).set(noa.auth)).status).toBe(200);

    const regen = await api().post(`/api/boards/${board.id}/share-link`).set(dana.auth);
    expect(regen.status).toBe(200);
    expect(regen.body.data.shareToken).not.toBe(board.shareToken);

    expectError(await api().post(`/api/boards/join/${board.shareToken}`).set(yael.auth), 404, 'BOARD_NOT_FOUND');
    expect((await api().post(`/api/boards/join/${regen.body.data.shareToken}`).set(yael.auth)).status).toBe(200);

    // existing member keeps access
    expect((await api().get(`/api/boards/${board.id}`).set(noa.auth)).status).toBe(200);
  });

  it('only the owner can regenerate, and only for SHARED boards', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    const shared = await createSharedBoard(dana, [noa], true);
    const priv = await createBoard(dana);
    expectError(await api().post(`/api/boards/${shared.id}/share-link`).set(noa.auth), 403, 'FORBIDDEN');
    expectError(await api().post(`/api/boards/${priv.id}/share-link`).set(dana.auth), 400, 'BOARD_IS_PRIVATE');
  });
});

describe('GET /api/boards — search, filter, pagination', () => {
  it('lists own and shared boards with filters', async () => {
    const dana = await registerUser('Dana');
    const noa = await registerUser('Noa');
    await createBoard(dana, { name: 'Groceries', description: 'weekly shopping' });
    await createBoard(dana, { name: 'Work', visibility: 'SHARED' });
    await createSharedBoard(noa, [dana], false); // Noa's board shared with Dana
    await createBoard(noa, { name: 'Noa private' }); // never visible to Dana

    const all = await api().get('/api/boards').set(dana.auth);
    expect(all.status).toBe(200);
    expect(all.body.data.pagination).toEqual({ page: 1, pageSize: 20, total: 3, totalPages: 1 });

    const search = await api().get('/api/boards?search=SHOP').set(dana.auth);
    expect(search.body.data.items.map((b: { name: string }) => b.name)).toEqual(['Groceries']);

    const shared = await api().get('/api/boards?visibility=SHARED').set(dana.auth);
    expect(shared.body.data.items).toHaveLength(2);

    const member = await api().get('/api/boards?role=member').set(dana.auth);
    expect(member.body.data.items).toHaveLength(1);
    expect(member.body.data.items[0].myAccess).toMatchObject({ isMember: true, canEdit: false });

    const owner = await api().get('/api/boards?role=owner').set(dana.auth);
    expect(owner.body.data.items).toHaveLength(2);

    const page2 = await api().get('/api/boards?page=2&pageSize=2').set(dana.auth);
    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });

    expectError(await api().get('/api/boards?pageSize=500').set(dana.auth), 400, 'VALIDATION_ERROR');
  });
});
