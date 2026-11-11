import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Store } from '../services/store.js';
import { newRun, irrigate, current, synthetic, tick, experiment } from '../simulation/engine.js';
import type { Farm, Plot } from '@agritwin/shared';

test('PostgreSQL migration and Prisma persist/reload normalized farm history', async () => {
  process.env.DB_POOL_SIZE = '1';
  let db = await PGlite.create();

  const migrationRoot = 'prisma/migrations';
  const migrations = (await fs.readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migration of migrations) {
    const sql = await fs.readFile(`${migrationRoot}/${migration}/migration.sql`, 'utf8');
    await db.exec(sql);
  }

  let server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 56379 });
  await server.start();
  const url = 'postgresql://postgres:postgres@127.0.0.1:56379/postgres?sslmode=disable',
    store = new Store('unused', url);
  try {
    await store.init();
    const plot: Plot = {
      id: 'db-plot',
      name: 'Test plot',
      area: 1000,
      soil: 'Loam',
      method: 'Drip',
      plantingDate: '2026-01-01',
    };
    const f: Farm = {
      id: 'db-farm',
      ownerId: 'db-user',
      name: 'Database farm',
      location: 'Test region',
      latitude: 12,
      longitude: 77,
      area: 1000,
      unit: 'm²',
      plots: [plot],
      run: newRun([plot], plot.plantingDate),
      archives: [],
      scenarios: [],
      createdAt: new Date().toISOString(),
    };
    await store.transaction((data) => {
      data.users.push({
        id: 'db-user',
        name: 'User',
        email: 'database@example.com',
        passwordHash: 'test-only',
      });
      data.farms.push(f);
    });
    await store.transaction(() => {
      irrigate(f.run, plot, 10, 'db-irrigation');
      tick(f.run, [plot], synthetic('2026-01-02'));
      f.observations = [
        {
          id: 'db-observation',
          plotId: plot.id,
          runId: f.run.id,
          date: '2026-01-02',
          createdAt: new Date().toISOString(),
          heightCm: 5,
          note: 'Measured',
          modelVersion: f.run.modelVersion,
          snapshotId: current(f.run).id,
          modeledStage: current(f.run).states[0].stage,
          modeledHarvestKg: 0,
        },
      ];
    });
    assert.equal(await store.db!.simulationSnapshot.count(), 3);
    assert.equal(await store.db!.weatherRecord.count(), 1);
    assert.equal(await store.db!.irrigationEvent.count(), 1);
    assert.equal(await store.db!.planting.count(), 1);
    const saved = structuredClone(current(f.run)),
      dump = await db.dumpDataDir();
    await store.close();
    await server.stop();
    await db.close();
    db = await PGlite.create({ loadDataDir: dump });
    server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 56379 });
    await server.start();
    const restored = new Store('unused', url);
    await restored.init();
    assert.equal(restored.data.farms[0].observations?.[0].heightCm, 5);
    assert.deepEqual(
      JSON.parse(JSON.stringify(current(restored.data.farms[0].run).states)),
      JSON.parse(JSON.stringify(saved.states)),
    );
    await restored.transaction(() => {
      const live = restored.data.farms[0];
      live.scenarios.push(
        experiment(
          live,
          {
            name: 'Branch',
            days: 2,
            rainMultiplier: 0.7,
            temperatureDelta: 4,
            irrigationMultiplier: 0.75,
            interval: 2,
            amount: 15,
          },
          [synthetic('2026-01-03'), synthetic('2026-01-04')],
        ),
      );
    });
    assert.equal(await restored.db!.scenario.count(), 1);
    await assert.rejects(() =>
      restored.transaction(() => {
        restored.data.farms[0].ownerId = 'missing-user';
      }),
    );
    assert.equal(restored.data.farms[0].ownerId, 'db-user');
    await restored.transaction((data) => {
      data.farms = [];
    });
    assert.equal(await restored.db!.simulationSnapshot.count(), 0);
    assert.equal(await restored.db!.plotState.count(), 0);
    assert.equal(await restored.db!.scenario.count(), 0);
    await restored.close();
  } finally {
    await store.close();
    await server.stop();
    await db.close();
  }
});
