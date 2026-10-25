import { initializeSoil } from './services/initialization.js';
import { marketPrices, MarketUnavailable } from './services/market.js';
import { seasonState, isMature } from '@agritwin/shared';
import { verifiedGoogleIdentity, firebaseEnabled } from './services/firebase.js';
import { CROPS, CROP_NAMES, MODEL_VERSION } from '@agritwin/shared';
import { harvest } from './simulation/engine.js';
import { openapi } from './openapi.js';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import pino from 'pino';
import { z } from 'zod';
import { farmInput, plotInput, scenarioInput, type Farm, type User } from '@agritwin/shared';
import { Store } from './services/store.js';
import { weatherFor, WeatherUnavailable, requireWeatherCoverage } from './services/weather.js';
import {
  CROP,
  SOILS,
  addDays,
  current,
  experiment,
  irrigate,
  newRun,
  predict,
  tick,
} from './simulation/engine.js';
export const log = pino({ level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' });
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function createApp(
  store = new Store(),
  secret = process.env.JWT_SECRET || '',
  origin = process.env.WEB_ORIGIN || 'http://localhost:5173',
) {
  if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  await store.init();
  const app = express(),
    server = createServer(app),
    io = new Server(server, {
      cors: { origin, credentials: true },
      allowRequest: (req, done) => done(null, !req.headers.origin || req.headers.origin === origin),
    }),
    revoked = new Map<string, number>();
  const prod = process.env.NODE_ENV === 'production';
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", 'https://apis.google.com', 'https://www.gstatic.com'],
          'connect-src': [
            "'self'",
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://www.googleapis.com',
            'https://firebaseinstallations.googleapis.com',
          ],
          'frame-src': [
            "'self'",
            'https://agridigitwin.firebaseapp.com',
            'https://*.firebaseapp.com',
            'https://accounts.google.com',
          ],
        },
      },
    }),
  );
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const start = Date.now();
    res.on('finish', () =>
      log.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start,
      }),
    );
    next();
  });
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== origin)
      return res.status(403).json({ error: 'Request origin is not allowed' });
    next();
  });
  function decode(token?: string) {
    try {
      if (!token) throw 0;
      const payload = jwt.verify(token, secret) as {
        sub: string;
        jti: string;
        exp: number;
        version: number;
      };
      if (
        revoked.has(payload.jti) ||
        (store.data.users.find((u) => u.id === payload.sub)?.sessionVersion || 0) !==
          (payload.version || 0)
      )
        throw 0;
      return payload;
    } catch {
      throw new HttpError(401, 'Please sign in to continue');
    }
  }
  function auth(req: Request, res: Response, next: NextFunction) {
    try {
      const claims = decode(req.cookies.session),
        user = store.data.users.find((u) => u.id === claims.sub);
      if (!user) throw new HttpError(401, 'Session not found');
      res.locals.user = user;
      res.locals.claims = claims;
      next();
    } catch (e) {
      next(e);
    }
  }
  function owner(id: string, user: User) {
    const f = store.data.farms.find((f) => f.id === id && f.ownerId === user.id);
    if (!f) throw new HttpError(404, 'Farm not found');
    return f;
  }
  const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email });
  function login(res: Response, user: User) {
    const token = jwt.sign({ version: user.sessionVersion || 0 }, secret, {
      subject: user.id,
      jwtid: randomUUID(),
      expiresIn: '7d',
    });
    res.cookie('session', token, {
      httpOnly: true,
      secure: prod,
      sameSite: process.env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax',
      maxAge: 604800000,
      path: '/',
    });
    res.json({ user: publicUser(user) });
  }
  function publish(f: Farm, event = 'farm:state-updated') {
    const data = {
      farmId: f.id,
      runId: f.run.id,
      version: f.run.version,
      snapshot: current(f.run),
      status: f.run.status,
      speed: f.run.speed,
    };
    io.to(`farm:${f.id}`).emit(event, data);
    if (event !== 'farm:state-updated') io.to(`farm:${f.id}`).emit('farm:state-updated', data);
  }
  const authLimit = rateLimit({ windowMs: 900000, limit: 35 });
  app.get('/api/health', (_, res) =>
    res.json({
      status: 'ok',
      storage: store.db ? 'postgresql' : 'local-file',
      model: MODEL_VERSION,
      frontend: existsSync(
        path.join(path.resolve(process.env.WEB_DIST_DIR || 'apps/web/dist'), 'index.html'),
      ),
      revision: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || null,
    }),
  );
  app.get('/api/crops', (_, res) => res.json({ crops: Object.values(CROPS), soils: SOILS }));
  app.get('/api/auth/providers', (_, res) => res.json({ google: firebaseEnabled() }));
  app.post('/api/auth/firebase', authLimit, async (req, res) => {
    const { idToken } = z.object({ idToken: z.string().min(20).max(10000) }).parse(req.body);
    let identity;
    try {
      identity = await verifiedGoogleIdentity(idToken);
    } catch (e) {
      throw new HttpError(firebaseEnabled() ? 401 : 503, (e as Error).message);
    }
    let linkedUserId: string | undefined;
    try {
      linkedUserId = decode(req.cookies.session).sub;
    } catch {}
    const user = await store.transaction((data) => {
      const existing = data.users.find((u) => u.firebaseUid === identity.uid);
      if (existing) return existing;
      const emailMatch = data.users.find((u) => u.email === identity.email);
      if (emailMatch) {
        if (linkedUserId !== emailMatch.id)
          throw new HttpError(
            409,
            'Sign in with your existing password first, then connect Google in Farm settings to preserve your farms.',
          );
        if (emailMatch.firebaseUid)
          throw new HttpError(409, 'This account is linked to another Google identity.');
        emailMatch.firebaseUid = identity.uid;
        return emailMatch;
      }
      const u: User = {
        id: randomUUID(),
        name: identity.name,
        email: identity.email,
        passwordHash: '',
        firebaseUid: identity.uid,
      };
      data.users.push(u);
      return u;
    });
    login(res, user);
  });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const b = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z
          .string()
          .email()
          .max(200)
          .transform((s) => s.toLowerCase()),
        password: z.string().min(10).max(128),
      })
      .parse(req.body);
    const hash = await bcrypt.hash(b.password, 12);
    const user = await store.transaction((data) => {
      if (data.users.some((u) => u.email === b.email))
        throw new HttpError(409, 'This email is already registered');
      const u = { id: randomUUID(), name: b.name, email: b.email, passwordHash: hash };
      data.users.push(u);
      return u;
    });
    login(res, user);
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const b = z
        .object({ email: z.string().email(), password: z.string().max(128) })
        .parse(req.body),
      u = store.data.users.find((u) => u.email === b.email.toLowerCase());
    if (!u || !(await bcrypt.compare(b.password, u.passwordHash)))
      throw new HttpError(401, 'Email or password is incorrect');
    login(res, u);
  });
  app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(res.locals.user) }));
  app.post('/api/auth/logout', auth, async (req, res) => {
    await store.transaction((data) => {
      const user = data.users.find((u) => u.id === res.locals.user.id)!;
      user.sessionVersion = (user.sessionVersion || 0) + 1;
    });
    revoked.set(res.locals.claims.jti, res.locals.claims.exp);
    io.in(`user:${res.locals.user.id}`).disconnectSockets();
    res
      .clearCookie('session', {
        path: '/',
        secure: prod,
        sameSite: process.env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax',
      })
      .json({ ok: true });
  });
  app.use('/api/farms', auth);
  app.get('/api/farms', (req, res) =>
    res.json(
      store.data.farms
        .filter((f) => f.ownerId === res.locals.user.id)
        .map((f) => ({
          ...f,
          archives: [],
          scenarios: [],
          run: { ...f.run, history: [current(f.run)] },
        })),
    ),
  );
  app.post('/api/farms', async (req, res) => {
    const b = farmInput.parse(req.body);
    const farm = await store.transaction((data) => {
      if (data.farms.filter((f) => f.ownerId === res.locals.user.id).length >= 20)
        throw new HttpError(400, 'Limit of 20 farms reached');
      const plots = b.plots.map((p) => ({ ...p, id: randomUUID() })),
        date = [...plots].map((p) => p.plantingDate).sort()[0];
      const f: Farm = {
        ...b,
        id: randomUUID(),
        ownerId: res.locals.user.id,
        plots,
        run: newRun(plots, date),
        archives: [],
        scenarios: [],
        createdAt: new Date().toISOString(),
      };
      data.farms.push(f);
      return f;
    });
    res.status(201).json(farm);
  });
  app.get('/api/farms/:id', (req, res) => res.json(owner(String(req.params.id), res.locals.user)));
  app.patch('/api/farms/:id', async (req, res) => {
    const b = z
      .object({
        name: z.string().trim().min(2).max(80),
        location: z.string().trim().min(2).max(100),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        area: z.number().min(10).max(10000000),
        unit: z.enum(['m²', 'ha', 'acre']),
      })
      .partial()
      .parse(req.body);
    const f = await store.transaction(() => {
      const f = owner(String(req.params.id), res.locals.user);
      if (b.area && b.area < f.plots.reduce((s, p) => s + p.area, 0))
        throw new HttpError(400, 'Farm area cannot be smaller than its plots');
      Object.assign(f, b);
      return f;
    });
    res.json(f);
  });
  app.delete('/api/farms/:id', async (req, res) => {
    await store.transaction((data) => {
      const f = owner(String(req.params.id), res.locals.user);
      data.farms = data.farms.filter((x) => x.id !== f.id);
    });
    io.to(`farm:${req.params.id}`).emit('farm:deleted', { farmId: req.params.id });
    res.json({ ok: true });
  });
  function editable(f: Farm) {
    if (f.run.version > 0 || f.archives.length)
      throw new HttpError(
        409,
        'Plot layout is locked after simulation starts. Create a new farm to change its plots.',
      );
  }
  app.post('/api/farms/:id/plots', async (req, res) => {
    const b = plotInput.parse(req.body),
      f = await store.transaction(() => {
        const f = owner(String(req.params.id), res.locals.user);
        editable(f);
        if (f.plots.length >= 24 || f.plots.reduce((s, p) => s + p.area, 0) + b.area > f.area)
          throw new HttpError(400, 'Plot count or farm area exceeded');
        f.plots.push({ ...b, id: randomUUID() });
        f.run = newRun(f.plots, f.plots.map((p) => p.plantingDate).sort()[0]);
        return f;
      });
    res.json(f);
  });
  app.patch('/api/farms/:id/plots/:plotId', async (req, res) => {
    const b = plotInput.parse(req.body),
      f = await store.transaction(() => {
        const f = owner(String(req.params.id), res.locals.user);
        editable(f);
        const p = f.plots.find((p) => p.id === req.params.plotId);
        if (!p) throw new HttpError(404, 'Plot not found');
        if (
          f.plots.filter((p) => p.id !== req.params.plotId).reduce((s, p) => s + p.area, 0) +
            b.area >
          f.area
        )
          throw new HttpError(400, 'Plot area exceeds farm area');
        Object.assign(p, b);
        f.run = newRun(f.plots, f.plots.map((p) => p.plantingDate).sort()[0]);
        return f;
      });
    res.json(f);
  });
  app.delete('/api/farms/:id/plots/:plotId', async (req, res) => {
    const f = await store.transaction(() => {
      const f = owner(String(req.params.id), res.locals.user);
      editable(f);
      if (f.plots.length === 1) throw new HttpError(400, 'A farm needs at least one plot');
      if (!f.plots.some((p) => p.id === req.params.plotId))
        throw new HttpError(404, 'Plot not found');
      f.plots = f.plots.filter((p) => p.id !== req.params.plotId);
      f.run = newRun(f.plots, f.plots.map((p) => p.plantingDate).sort()[0]);
      return f;
    });
    res.json(f);
  });
  app.post('/api/farms/:id/initialize-soil', async (req, res) => {
    const farm = await store.transaction(async () => {
      const f = owner(String(req.params.id), res.locals.user);
      if (current(f.run).day !== 0 || f.run.events.length)
        throw new HttpError(
          409,
          'Initialize soil before advancing or recording irrigation. Start a new season to preserve existing history.',
        );
      await initializeSoil(f);
      return f;
    });
    publish(farm, 'simulation:ticked');
    res.json(farm);
  });
  app.get('/api/farms/:id/weather', async (req, res) => {
    const f = owner(String(req.params.id), res.locals.user);
    res.json(await weatherFor(f, current(f.run).date, 16));
  });
  async function advance(f: Farm, days: number) {
    await initializeSoil(f);
    if (seasonState(f.run, f.plots).blocked) {
      f.run.status = 'paused';
      return;
    }
    if (current(f.run).day + days > 730)
      throw new HttpError(400, 'This run reached its 730-day limit. Reset to begin a new run.');
    const start = addDays(current(f.run).date, 1),
      weather = await weatherFor(f, start, days);
    requireWeatherCoverage(weather, start, days);
    for (const w of weather) {
      if (seasonState(f.run, f.plots).blocked) {
        f.run.status = 'paused';
        break;
      }
      tick(f.run, f.plots, w);
    }
  }
  app.post('/api/farms/:id/control', async (req, res) => {
    const b = z
      .object({
        action: z.enum(['start', 'pause', 'step', 'reset', 'speed']),
        days: z.number().int().min(1).max(120).default(1),
        speed: z.number().int().min(1).max(10).default(1),
      })
      .parse(req.body);
    const f = await store.transaction(async () => {
      const f = owner(String(req.params.id), res.locals.user);
      if (b.action === 'step') await advance(f, b.days);
      if (b.action === 'start')
        f.run.status = seasonState(f.run, f.plots).blocked ? 'paused' : 'running';
      if (b.action === 'pause') f.run.status = 'paused';
      if (b.action === 'speed') f.run.speed = b.speed;
      if (b.action === 'reset') {
        if (f.archives.length >= 10)
          throw new HttpError(400, 'Archive limit reached; create another farm');
        f.run.status = 'paused';
        f.archives.push(structuredClone(f.run));
        f.run = newRun(f.plots, f.run.history[0].date);
      }
      return f;
    });
    publish(
      f,
      b.action === 'start'
        ? 'simulation:started'
        : b.action === 'pause'
          ? 'simulation:paused'
          : 'simulation:ticked',
    );
    res.json(f);
  });
  app.post('/api/farms/:id/irrigation', async (req, res) => {
    const b = z
      .object({
        plotId: z.string(),
        amount: z.number().min(0.1).max(100),
        id: z.string().uuid(),
        date: z.string().date().optional(),
        interval: z.number().int().min(0).max(30).default(0),
      })
      .parse(req.body);
    const f = await store.transaction(() => {
      const f = owner(String(req.params.id), res.locals.user),
        p = f.plots.find((p) => p.id === b.plotId);
      if (!p) throw new HttpError(404, 'Plot not found');
      if (b.date) {
        if (
          isMature(
            f.run,
            p,
            current(f.run).states.find((s) => s.plotId === p.id)!,
          )
        )
          throw new HttpError(
            400,
            'This crop has reached maturity. Record the harvest instead of scheduling irrigation.',
          );
        if (b.date <= current(f.run).date)
          throw new HttpError(400, 'Schedule must begin after the current virtual date');
        if (!f.run.events.some((e) => e.id === b.id))
          f.run.events.push({
            id: b.id,
            plotId: p.id,
            date: b.date,
            amount: b.amount,
            interval: b.interval,
            enabled: true,
            appliedDates: [],
            kind: 'schedule',
          });
      } else {
        if (
          isMature(
            f.run,
            p,
            current(f.run).states.find((s) => s.plotId === p.id)!,
          )
        )
          throw new HttpError(
            400,
            'This crop has reached maturity. Record the harvest instead of applying irrigation.',
          );
        irrigate(f.run, p, b.amount, b.id);
      }
      return f;
    });
    publish(f, 'irrigation:applied');
    res.json(f);
  });
  app.patch('/api/farms/:id/irrigation/:eventId', async (req, res) => {
    const b = z.object({ enabled: z.boolean() }).parse(req.body);
    const f = await store.transaction(() => {
      const f = owner(String(req.params.id), res.locals.user),
        e = f.run.events.find((e) => e.id === req.params.eventId && e.kind === 'schedule');
      if (!e) throw new HttpError(404, 'Schedule not found');
      const p = f.plots.find((p) => p.id === e.plotId)!;
      if (
        b.enabled &&
        isMature(
          f.run,
          p,
          current(f.run).states.find((s) => s.plotId === p.id)!,
        )
      )
        throw new HttpError(400, 'A mature crop cannot resume scheduled irrigation.');
      e.enabled = b.enabled;
      return f;
    });
    res.json(f);
  });
  app.post('/api/farms/:id/harvest', async (req, res) => {
    const b = z
      .object({ id: z.string().uuid(), plotId: z.string(), kg: z.number().nonnegative() })
      .parse(req.body);
    const f = await store.transaction(() => {
      const f = owner(String(req.params.id), res.locals.user),
        p = f.plots.find((p) => p.id === b.plotId);
      if (!p) throw new HttpError(404, 'Plot not found');
      try {
        harvest(f.run, p, b.kg, b.id);
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
      return f;
    });
    publish(f);
    res.json(f);
  });
  app.get('/api/farms/:id/predictions', async (req, res) => {
    const f = owner(String(req.params.id), res.locals.user),
      snap = current(f.run);
    res.json(
      f.plots.map((p) => {
        const s = snap.states.find((s) => s.plotId === p.id)!;
        return predict(p, s, 0, f.run.modelVersion);
      }),
    );
  });
  app.post('/api/farms/:id/scenarios', async (req, res) => {
    const b = scenarioInput.parse(req.body);
    const scenario = await store.transaction(async () => {
      const f = owner(String(req.params.id), res.locals.user);
      if (f.scenarios.length >= 30) throw new HttpError(400, 'Limit of 30 scenarios reached');
      const start = addDays(current(f.run).date, 1),
        weather = await weatherFor(f, start, b.days);
      requireWeatherCoverage(weather, start, b.days);
      const s = experiment(f, b, weather);
      f.scenarios.push(s);
      return s;
    });
    res.status(201).json(scenario);
  });
  app.get('/api/farms/:id/market', async (req, res) => {
    owner(String(req.params.id), res.locals.user);
    const q = z
      .object({
        state: z.string().trim().min(2).max(60),
        crop: z.enum(CROP_NAMES),
      })
      .parse(req.query);
    res.json(await marketPrices(q.state, q.crop));
  });
  app.patch('/api/farms/:id/economics', async (req, res) => {
    const b = z
      .array(
        z.object({
          plotId: z.string(),
          pricePerKg: z.number().min(0).max(100000).nullable(),
          fixedCost: z.number().min(0).max(1e10),
          waterCostPerM3: z.number().min(0).max(1e6),
        }),
      )
      .max(24)
      .parse(req.body);
    const f = await store.transaction(() => {
      const f = owner(String(req.params.id), res.locals.user);
      if (
        new Set(b.map((x) => x.plotId)).size !== b.length ||
        b.some((x) => !f.plots.some((p) => p.id === x.plotId))
      )
        throw new HttpError(400, 'Invalid plot cost assumptions');
      f.economics = b;
      return f;
    });
    res.json(f);
  });
  app.get('/api/farms/:id/analytics', (req, res) => {
    const f = owner(String(req.params.id), res.locals.user);
    res.json({ history: f.run.history, events: f.run.events, archives: f.archives });
  });
  io.use((socket, next) => {
    try {
      const cookies = Object.fromEntries(
        (socket.handshake.headers.cookie || '').split(';').map((p) => p.trim().split('=')),
      );
      const claims = decode(cookies.session);
      socket.data.claims = claims;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.claims.sub}`);
    socket.on('farm:join', (id: string, ack?: (v: unknown) => void) => {
      try {
        if (socket.data.claims.exp < Date.now() / 1000) throw new Error('Expired');
        const user = store.data.users.find((u) => u.id === socket.data.claims.sub)!;
        const f = owner(id, user);
        for (const room of socket.rooms) if (room.startsWith('farm:')) socket.leave(room);
        socket.join(`farm:${f.id}`);
        ack?.({ ok: true, version: f.run.version });
      } catch {
        ack?.({ error: 'Farm access denied' });
      }
    });
  });
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const f of [...store.data.farms])
        if (f.run.status === 'running') {
          try {
            await store.transaction(async () => {
              const active = store.data.farms.find((x) => x.id === f.id);
              if (active?.run.status === 'running') await advance(active, active.run.speed);
            });
            const latest = store.data.farms.find((x) => x.id === f.id);
            if (latest) publish(latest, 'simulation:ticked');
          } catch (e) {
            log.error({ err: e }, 'Simulation paused after failure');
            await store.transaction(() => {
              const active = store.data.farms.find((x) => x.id === f.id);
              if (active) active.run.status = 'paused';
            });
            io.to(`farm:${f.id}`).emit('simulation:error', { message: (e as Error).message });
          }
        }
      for (const [id, expiry] of revoked) if (expiry < Date.now() / 1000) revoked.delete(id);
    } finally {
      busy = false;
    }
  }, 3000);
  timer.unref();
  app.get('/api/openapi.json', (_, res) => res.json(openapi));
  app.get('/api/docs', (_, res) =>
    res
      .type('html')
      .send(
        '<!doctype html><title>AgriTwin API</title><h1>AgriTwin API</h1><p>OpenAPI 3.1 definition: <a href="/api/openapi.json">Download specification</a></p><p>Cookie authentication and matching Origin header are required for mutations. See docs/API.md in the project.</p>',
      ),
  );
  const webDist = path.resolve(process.env.WEB_DIST_DIR || 'apps/web/dist');
  if (prod || process.env.WEB_DIST_DIR) {
    if (existsSync(path.join(webDist, 'index.html'))) {
      app.use(express.static(webDist, { index: false, maxAge: '1h' }));
      app.get('*splat', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path === '/socket.io') return next();
        res.sendFile(path.join(webDist, 'index.html'), (error) => error && next(error));
      });
    }
  }
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(';') });
    const status =
      err instanceof WeatherUnavailable || err instanceof MarketUnavailable
        ? 503
        : err instanceof HttpError
          ? err.status
          : 500;
    if (status === 500) log.error({ err }, 'Request failed');
    res.status(status).json({
      error: status === 500 ? 'The operation failed. Please retry.' : (err as Error).message,
    });
  });
  return {
    app,
    server,
    io,
    store,
    close: async () => {
      clearInterval(timer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await store.close();
    },
  };
}
