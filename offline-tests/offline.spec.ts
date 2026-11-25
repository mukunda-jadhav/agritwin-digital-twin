import { test, expect } from '@playwright/test';

test('saved farm reload, offline diary sync, expenses, mobile guide and account isolation', async ({ page, context }, testInfo) => {
  let user: any = { id: 'offline-user', name: 'Test farmer', email: 'farmer@example.com' };
  const farm: any = {
    id: 'offline-farm', ownerId: user.id, name: 'Offline test farm', location: 'Pune', latitude: 18.5, longitude: 73.8, area: 1000, unit: 'acre',
    plots: [{ id: 'plot-1', name: 'My plot', area: 1000, soil: 'Loam', method: 'Drip', plantingDate: '2026-06-15', crop: 'Soybean' }],
    run: { id: 'run-1', modelVersion: 'agritwin-maharashtra-v3', status: 'paused', speed: 1, version: 0, history: [], weather: [], events: [] },
    archives: [], scenarios: [], diary: [], createdAt: '2026-06-15',
  };
  let saves = 0, failSync = false;
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { user } });
    if (path === '/api/health') return route.fulfill({ json: { status: 'ok' } });
    if (path === '/api/farms') return route.fulfill({ json: user.id === farm.ownerId ? [farm] : [] });
    if (path.endsWith('/predictions')) return route.fulfill({ json: [] });
    if (path.endsWith('/diary') && route.request().method() === 'POST') {
      if (failSync) return route.fulfill({ status: 503, json: { error: 'Temporary test failure' } });
      const entry = route.request().postDataJSON(); saves++;
      if (!farm.diary.some((d: any) => d.id === entry.id)) farm.diary.push({ ...entry, createdAt: new Date().toISOString() });
    }
    return route.fulfill({ json: farm });
  });
  await page.goto('/app/diary');
  await expect(page.getByRole('heading', { name: 'Farm diary', exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByText('Offline access', { exact: true }).click();
  await page.getByRole('button', { name: 'Save farms offline' }).click();
  await expect(page.getByText(/Saved on this device/, { exact: false }).first()).toBeVisible();
  await page.getByLabel('Entry type').selectOption('expense');
  await page.getByLabel('Amount (₹)').fill('1250.50');
  await page.getByLabel('What did you do?').fill('Bought seeds');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByText('Diary entry saved.', { exact: true })).toBeVisible();
  expect(farm.diary[0].amountPaise).toBe(125050);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline — viewing saved data')).toBeVisible();
  await expect(page.getByText('Bought seeds', { exact: true })).toBeVisible();
  await page.getByLabel('What did you do?').fill('Checked the leaves offline');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByText('Saved on this device — waiting to sync.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Checked the leaves offline', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: testInfo.outputPath('diary-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  failSync = true;
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Sync entries', exact: true }).click();
  await expect(page.getByText('Temporary test failure')).toBeVisible();
  await expect(page.getByText('Checked the leaves offline', { exact: true })).toBeVisible();
  failSync = false;
  await page.getByRole('button', { name: 'Sync entries', exact: true }).click();
  await expect(page.getByText('Diary entries synced.', { exact: true })).toBeVisible();
  expect(saves).toBe(2);
  expect(farm.diary).toHaveLength(2);
  await page.goto('/app/insights');
  await expect(page.getByRole('heading', { name: 'Which crop for which season?' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Rabi · Cool season' }).click();
  await expect(page.getByText('Chickpea', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('guide-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(false);
  user = { id: 'other-user', name: 'Other farmer', email: 'other@example.com' };
  await page.goto('/app/farms');
  await expect(page.getByText('Offline test farm', { exact: true })).toHaveCount(0);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Could not connect' })).toBeVisible();
  await expect(page.getByText('Offline test farm', { exact: true })).toHaveCount(0);
});
