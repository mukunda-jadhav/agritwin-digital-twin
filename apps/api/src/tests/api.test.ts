import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { io as client } from 'socket.io-client';
import { createApp } from '../app.js';
import { Store } from '../services/store.js';
test('registration, ownership, irrigation, socket rooms, and persistent restart', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agritwin-test-')),
    file = path.join(dir, 'data.json'),
    origin = 'http://localhost:5173',
    app = await createApp(
      new Store(file, ''),
      'test-secret-longer-than-thirty-two-characters',
      origin,
    );
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const port = (app.server.address() as { port: number }).port,
    url = `http://127.0.0.1:${port}`;
  const request = async (
    route: string,
    body?: unknown,
    cookie = '',
    method = body ? 'POST' : 'GET',
  ) => {
    const res = await fetch(url + '/api' + route, {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get('set-cookie')?.split(';')[0] || '',
    };
  };
  let socket: ReturnType<typeof client> | undefined;
  try {
    const a = await request('/auth/register', {
        name: 'Alice',
        email: 'alice@example.com',
        password: 'testpassword123',
      }),
      b = await request('/auth/register', {
        name: 'Bob',
        email: 'bob@example.com',
        password: 'testpassword123',
      });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const created = await request(
      '/farms',
      {
        name: 'Test farm',
        location: 'Test region',
        latitude: 0,
        longitude: 0,
        area: 1000,
        unit: 'm²',
        plots: [
          { name: 'Plot A', area: 1000, soil: 'Loam', method: 'Drip', plantingDate: '2026-01-01' },
        ],
      },
      a.cookie,
    );
    assert.equal(created.status, 201);
    const farm = created.data;
    assert.equal((await request(`/farms/${farm.id}`, undefined, b.cookie)).status, 404);
    assert.equal(
      (
        await request(
          `/farms/${farm.id}/irrigation`,
          { plotId: farm.plots[0].id, amount: 10, id: crypto.randomUUID() },
          b.cookie,
        )
      ).status,
      404,
    );
    assert.equal((await request('/farms')).status, 401);
    socket = client(url, { extraHeaders: { Cookie: a.cookie }, transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => {
      socket!.on('connect', resolve);
      socket!.on('connect_error', reject);
    });
    const joined = await new Promise<any>((resolve) => socket!.emit('farm:join', farm.id, resolve));
    assert.equal(joined.ok, true);
    const event = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket event timeout')), 3000);
      socket!.once('farm:state-updated', (v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
    const id = crypto.randomUUID(),
      applied = await request(
        `/farms/${farm.id}/irrigation`,
        { plotId: farm.plots[0].id, amount: 10, id },
        a.cookie,
      );
    assert.equal(applied.status, 200);
    assert.equal((await event).version, 1);
    const duplicate = await request(
      `/farms/${farm.id}/irrigation`,
      { plotId: farm.plots[0].id, amount: 10, id },
      a.cookie,
    );
    assert.equal(duplicate.data.run.version, 1);
    const other = client(url, { extraHeaders: { Cookie: b.cookie }, transports: ['websocket'] });
    await new Promise<void>((r, j) => {
      other.on('connect', r);
      other.on('connect_error', j);
    });
    const denied = await new Promise<any>((r) => other.emit('farm:join', farm.id, r));
    assert.ok(denied.error);
    other.disconnect();
    const reread = new Store(file, '');
    await reread.init();
    assert.equal(reread.data.farms[0].run.version, 1);
    assert.equal(reread.data.farms[0].run.history.at(-1)!.states[0].waterLitres, 10000);
    const invalid = await request(
      `/farms/${farm.id}/irrigation`,
      { plotId: farm.plots[0].id, amount: -1, id: crypto.randomUUID() },
      a.cookie,
    );
    assert.equal(invalid.status, 400);
    const noOrigin = await fetch(url + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'testpassword123' }),
    });
    assert.equal(noOrigin.status, 403);
    await request('/auth/logout', {}, a.cookie);
    assert.equal((await request('/auth/me', undefined, a.cookie)).status, 401);
  } finally {
    socket?.disconnect();
    await app.close();
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('agritwin-test-'));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
