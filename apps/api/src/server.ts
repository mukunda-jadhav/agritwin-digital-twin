import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createApp, log } from './app.js';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL)
  throw new Error(
    'Production requires DATABASE_URL; local file persistence is for development only.',
  );
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('Set JWT_SECRET in production');
  await fs.mkdir('data', { recursive: true });
  try {
    process.env.JWT_SECRET = await fs.readFile('data/session-secret', 'utf8');
  } catch {
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    await fs.writeFile('data/session-secret', process.env.JWT_SECRET, { mode: 0o600 });
  }
}
if (!process.env.WEB_ORIGIN && process.env.RENDER_EXTERNAL_HOSTNAME)
  process.env.WEB_ORIGIN = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
if (!process.env.WEB_DIST_DIR)
  process.env.WEB_DIST_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../web/dist',
  );
const service = await createApp();
service.server.listen(Number(process.env.PORT || 4000), '0.0.0.0', () =>
  log.info(
    {
      port: process.env.PORT || 4000,
      storage: service.store.db ? 'PostgreSQL' : 'local file',
    },
    'AgriTwin API ready',
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await service.close();
    process.exit(0);
  });
