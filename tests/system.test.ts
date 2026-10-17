import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/docs/openapi.js';
import { apiRouter } from '../src/routes/index.js';
import { api, useCleanDatabase } from './helpers.js';

useCleanDatabase();

describe('health', () => {
  it('GET /api/health reports the server and database as up', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('unknown routes return the error envelope', async () => {
    const res = await api().get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('CORS allows the configured origin only', async () => {
    const ok = await api().options('/api/boards').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await api().options('/api/boards').set('Origin', 'http://evil.example').set('Access-Control-Request-Method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Prisma', () => {
  it('schema is valid and all migrations are applied', () => {
    const opts = { env: { ...process.env }, stdio: 'pipe' as const };
    expect(() => execSync('npx prisma validate', opts)).not.toThrow();
    const status = execSync('npx prisma migrate status', opts).toString();
    expect(status).toMatch(/Database schema is up to date/);
  });
});

describe('Swagger / OpenAPI', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    const doc = structuredClone(openApiDocument);
    await expect(SwaggerParser.validate(doc as never)).resolves.toBeTruthy();
    expect(openApiDocument.openapi).toBe('3.1.0');
    expect(openApiDocument.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  });

  it('documents every route the server exposes (and nothing else)', () => {
    const toOpenApi = (p: string) => `/api${p.replace(/:(\w+)/g, '{$1}')}`;
    const routes = new Set<string>();
    for (const layer of (apiRouter as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack) {
      if (!layer.route) continue;
      for (const m of Object.keys(layer.route.methods)) routes.add(`${m.toUpperCase()} ${toOpenApi(layer.route.path)}`);
    }
    const documented = new Set<string>();
    for (const [path, item] of Object.entries(openApiDocument.paths)) {
      for (const m of ['get', 'post', 'patch', 'delete', 'put']) if (m in item) documented.add(`${m.toUpperCase()} ${path}`);
    }
    expect([...routes].sort()).toEqual([...documented].sort());
    expect(routes.size).toBeGreaterThanOrEqual(25);
  });

  it('protected endpoints declare bearerAuth; public ones do not', () => {
    const publicOps = new Set(['GET /api/health', 'POST /api/auth/register', 'POST /api/auth/login']);
    for (const [path, item] of Object.entries(openApiDocument.paths)) {
      for (const [method, op] of Object.entries(item)) {
        if (method === 'parameters') continue;
        const key = `${method.toUpperCase()} ${path}`;
        const security = (op as { security?: unknown }).security;
        if (publicOps.has(key)) expect(security, key).toBeUndefined();
        else expect(security, key).toEqual([{ bearerAuth: [] }]);
      }
    }
  });

  it('serves Swagger UI at /api-docs and the JSON at /api-docs/openapi.json', async () => {
    const ui = await api().get('/api-docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');

    const json = await api().get('/api-docs/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe('3.1.0');
  });

  it('docs/openapi.json is up to date (run `npm run docs:generate` if this fails)', () => {
    const onDisk = JSON.parse(readFileSync('docs/openapi.json', 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(openApiDocument)));
  });
});
