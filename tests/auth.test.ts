import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { api, expectError, PASSWORD, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();

describe('POST /api/auth/register', () => {
  it('creates a user, returns a token and never exposes the password hash', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ email: '  New.User@Example.com ', password: 'Secret123', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: 'new.user@example.com', name: 'New User' });
    expect(res.body.data.tokenType).toBe('Bearer');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|argon2/);
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
    const user = await registerUser('Dup');
    const res = await api().post('/api/auth/register').send({ email: user.email, password: 'Secret123', name: 'Other' });
    expectError(res, 409, 'EMAIL_TAKEN');
  });

  it('validates input (400 VALIDATION_ERROR with details)', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'not-an-email', password: 'short', name: '' });
    expectError(res, 400, 'VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password', 'name']));
  });

  it('rejects malformed JSON with 400 INVALID_JSON', async () => {
    const res = await api().post('/api/auth/register').set('Content-Type', 'application/json').send('{"email":');
    expectError(res, 400, 'INVALID_JSON');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const user = await registerUser('Login');
    const res = await api().post('/api/auth/login').send({ email: user.email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
    const user = await registerUser('Wrong');
    const res = await api().post('/api/auth/login').send({ email: user.email, password: 'Wrong-pass1' });
    expectError(res, 401, 'INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with the same 401 error', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nobody@test.example', password: 'Whatever1' });
    expectError(res, 401, 'INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me and token checks', () => {
  it('returns the current user for a valid token', async () => {
    const user = await registerUser('Me');
    const res = await api().get('/api/auth/me').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.id, email: user.email });
  });

  it('401 UNAUTHORIZED without a token', async () => {
    expectError(await api().get('/api/auth/me'), 401, 'UNAUTHORIZED');
  });

  it('401 INVALID_TOKEN for a malformed header or garbage token', async () => {
    expectError(await api().get('/api/auth/me').set('Authorization', 'Token abc'), 401, 'INVALID_TOKEN');
    expectError(await api().get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt'), 401, 'INVALID_TOKEN');
  });

  it('401 INVALID_TOKEN for a token signed with another secret', async () => {
    const user = await registerUser('Forged');
    const decoded = jwt.decode(user.token) as { sid: string };
    const forged = jwt.sign({ sid: decoded.sid }, 'some-other-secret-that-is-long-enough!!', {
      subject: user.id,
      issuer: 'task-boards-api',
      expiresIn: 600,
    });
    expectError(await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`), 401, 'INVALID_TOKEN');
  });

  it('401 INVALID_TOKEN for an expired token', async () => {
    const user = await registerUser('Expired');
    const decoded = jwt.decode(user.token) as { sid: string };
    const expired = jwt.sign(
      { sid: decoded.sid, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!,
      { subject: user.id, issuer: 'task-boards-api' },
    );
    expectError(await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`), 401, 'INVALID_TOKEN');
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session on the server: the same token stops working', async () => {
    const user = await registerUser('Logout');
    const res = await api().post('/api/auth/logout').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ loggedOut: true });

    expectError(await api().get('/api/auth/me').set(user.auth), 401, 'INVALID_TOKEN');
    expectError(await api().get('/api/boards').set(user.auth), 401, 'INVALID_TOKEN');
  });

  it('only ends the current session, other logins keep working', async () => {
    const user = await registerUser('Multi');
    const second = await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    const secondAuth = { Authorization: `Bearer ${second.body.data.accessToken}` };

    await api().post('/api/auth/logout').set(user.auth);
    expect((await api().get('/api/auth/me').set(secondAuth)).status).toBe(200);
  });

  it('requires a token', async () => {
    expectError(await api().post('/api/auth/logout'), 401, 'UNAUTHORIZED');
  });
});
