import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Farm, User } from '@agritwin/shared';
import { CROPS, MODEL_VERSION } from '@agritwin/shared';
import { CROP, current, predict } from '../simulation/engine.js';
type Data = { users: User[]; farms: Farm[] };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export class Store {
  data: Data = { users: [], farms: [] };
  db: PrismaClient | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private file = path.resolve(process.env.DATA_DIR || 'data', 'agritwin.json'),
    private databaseUrl = process.env.DATABASE_URL,
  ) {}
  async init() {
    if (this.databaseUrl) {
      this.db = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: this.databaseUrl,
          max: Number(process.env.DB_POOL_SIZE || 5),
        }),
      });
      await this.db.$connect();
      for (const crop of Object.values(CROPS))
        await this.db.crop.upsert({
          where: { id: `${MODEL_VERSION}-${crop.name}` },
          create: { id: `${MODEL_VERSION}-${crop.name}`, name: crop.name, parameters: json(crop) },
          update: {},
        });
      await this.db.crop.upsert({
        where: { id: CROP.version },
        create: { id: CROP.version, name: 'Tomato', parameters: json(CROP) },
        update: {},
      });
      this.data.users = await this.db.user.findMany();
      const farms = await this.db.farm.findMany({
        include: {
          plots: true,
          runs: {
            include: {
              snapshots: { orderBy: { version: 'asc' }, include: { states: true } },
              events: true,
              weather: true,
              harvests: true,
            },
          },
          scenarios: true,
        },
      });
      this.data.farms = farms.map((f) => {
        const runs = f.runs.map((r) => ({
          id: r.id,
          modelVersion: r.modelVersion,
          status: 'paused',
          speed: r.speed,
          version: r.version,
          history: r.snapshots.map((s) => ({
            ...s,
            weather: s.weather,
            states: s.states.map((p) => p.data),
          })),
          events: r.events,
          harvests: r.harvests,
          weather: r.weather.map((w) => w.data),
        }));
        return {
          ...f,
          createdAt: f.createdAt.toISOString(),
          run: runs[f.runs.findIndex((r) => r.active)],
          archives: runs.filter((_, i) => !f.runs[i].active),
          scenarios: f.scenarios.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
        } as unknown as Farm;
      });
    } else {
      try {
        this.data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      for (const f of this.data.farms) f.run.status = 'paused';
    }
  }
  async transaction<T>(fn: (data: Data) => Promise<T> | T): Promise<T> {
    const operation = this.queue.then(async () => {
      const backup = structuredClone(this.data);
      try {
        const result = await fn(this.data);
        await this.persist(backup);
        return result;
      } catch (e) {
        this.data = backup;
        throw e;
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  private async persist(previous: Data) {
    if (!this.db) {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file + '.tmp', JSON.stringify(this.data));
      await fs.rename(this.file + '.tmp', this.file);
      return;
    }
    await this.db.$transaction(
      async (tx) => {
        for (const u of this.data.users)
          if (JSON.stringify(previous.users.find((x) => x.id === u.id)) !== JSON.stringify(u)) {
            const fields = {
              name: u.name,
              email: u.email,
              passwordHash: u.passwordHash,
              sessionVersion: u.sessionVersion || 0,
              firebaseUid: u.firebaseUid || null,
            };
            await tx.user.upsert({
              where: { id: u.id },
              create: { id: u.id, ...fields },
              update: fields,
            });
          }
        for (const old of previous.farms)
          if (!this.data.farms.some((f) => f.id === old.id))
            await tx.farm.delete({ where: { id: old.id } });
        for (const f of this.data.farms) {
          const old = previous.farms.find((x) => x.id === f.id);
          if (old && JSON.stringify(old) === JSON.stringify(f)) continue;
          const metadata = {
            ownerId: f.ownerId,
            name: f.name,
            location: f.location,
            latitude: f.latitude,
            longitude: f.longitude,
            area: f.area,
            unit: f.unit,
            economics: f.economics ? json(f.economics) : Prisma.JsonNull,
            boundary: f.boundary ? json(f.boundary) : Prisma.JsonNull,
          };
          await tx.farm.upsert({
            where: { id: f.id },
            create: { id: f.id, ...metadata },
            update: metadata,
          });
          await tx.simulationRun.deleteMany({
            where: { farmId: f.id, id: { notIn: [...f.archives, f.run].map((r) => r.id) } },
          });
          const removed = old?.plots.filter((p) => !f.plots.some((x) => x.id === p.id)) || [];
          for (const p of removed) await tx.plot.delete({ where: { id: p.id } });
          for (const p of f.plots) {
            await tx.plot.upsert({
              where: { id: p.id },
              create: { ...p, farmId: f.id },
              update: p,
            });
            await tx.planting.upsert({
              where: { plotId: p.id },
              create: {
                id: p.id,
                plotId: p.id,
                cropId:
                  f.run.modelVersion === CROP.version
                    ? CROP.version
                    : `${MODEL_VERSION}-${p.crop || 'Tomato'}`,
                plantingDate: p.plantingDate,
              },
              update: {
                plantingDate: p.plantingDate,
                cropId:
                  f.run.modelVersion === CROP.version
                    ? CROP.version
                    : `${MODEL_VERSION}-${p.crop || 'Tomato'}`,
              },
            });
          }
          for (const r of [...f.archives, f.run]) {
            const meta = {
              modelVersion: r.modelVersion,
              status: r.status,
              speed: r.speed,
              version: r.version,
              active: r.id === f.run.id,
            };
            await tx.simulationRun.upsert({
              where: { id: r.id },
              create: { id: r.id, farmId: f.id, ...meta },
              update: meta,
            });
            const prior = [...(old?.archives || []), ...(old ? [old.run] : [])].find(
              (x) => x.id === r.id,
            );
            for (const s of r.history.filter((s) => !prior?.history.some((x) => x.id === s.id)))
              await tx.simulationSnapshot.create({
                data: {
                  id: s.id,
                  runId: r.id,
                  date: s.date,
                  day: s.day,
                  version: s.version,
                  weather: s.weather ? json(s.weather) : Prisma.JsonNull,
                  states: {
                    create: s.states.map((state) => ({ plotId: state.plotId, data: json(state) })),
                  },
                },
              });
            for (const e of r.events)
              await tx.irrigationEvent.upsert({
                where: { id: e.id },
                create: { ...e, runId: r.id },
                update: e,
              });
            for (const e of r.harvests || [])
              await tx.harvestEvent.upsert({
                where: { id: e.id },
                create: { ...e, runId: r.id },
                update: {},
              });
            for (const w of r.weather)
              await tx.weatherRecord.upsert({
                where: { runId_date: { runId: r.id, date: w.date } },
                create: { runId: r.id, date: w.date, source: w.source, data: json(w) },
                update: {},
              });
            const snap = current(r);
            await tx.prediction.upsert({
              where: { runId_version: { runId: r.id, version: r.version } },
              create: {
                runId: r.id,
                version: r.version,
                data: json(
                  f.plots.map((p) =>
                    predict(
                      p,
                      snap.states.find((s) => s.plotId === p.id)!,
                      0,
                      r.modelVersion,
                    ),
                  ),
                ),
              },
              update: {},
            });
          }
          for (const s of f.scenarios.filter((s) => !old?.scenarios.some((x) => x.id === s.id)))
            await tx.scenario.create({
              data: {
                id: s.id,
                farmId: f.id,
                config: json(s.config),
                baseline: json(s.baseline),
                experiment: json(s.experiment),
              },
            });
        }
      },
    );
  }
  async close() {
    await this.queue;
    await this.db?.$disconnect();
  }
}
