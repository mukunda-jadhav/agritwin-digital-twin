import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
const renderUrl =
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : undefined);
const configuredOrigin = process.env.WEB_ORIGIN;
if (
  renderUrl &&
  (!configuredOrigin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredOrigin))
)
  process.env.WEB_ORIGIN = renderUrl;

const here = path.dirname(fileURLToPath(import.meta.url));
const webDistCandidates = [
  process.env.WEB_DIST_DIR,
  path.resolve(here, '../../web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
  path.resolve(process.cwd(), '../web/dist'),
].filter((candidate): candidate is string => Boolean(candidate));
const webDistDir = webDistCandidates.find((candidate) =>
  existsSync(path.join(candidate, 'index.html')),
);
if (webDistDir) process.env.WEB_DIST_DIR = webDistDir;
else log.error({ candidates: webDistCandidates }, 'Built web app was not found');
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
