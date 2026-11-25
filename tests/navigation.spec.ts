import { test, expect } from '@playwright/test';

test('signed-in logo and public routes stay in the workspace; sign out is explicit', async ({ page }) => {
  let signedIn = true;
  let logouts = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/logout') { signedIn = false; logouts++; return route.fulfill({ json: { ok: true } }); }
    if (path === '/api/auth/me') return route.fulfill(signedIn ? { json: { user: { id: 'user', name: 'Farmer', email: 'farmer@example.com' } } } : { status: 401, json: { error: 'Please sign in to continue' } });
    if (path === '/api/farms') return route.fulfill({ json: [] });
    return route.fulfill({ json: { google: false } });
  });
  await page.goto('http://127.0.0.1:5179/app/farms');
  await page.locator('.sidebar .brand').click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  expect(logouts).toBe(0);
  for (const path of ['/', '/login', '/register']) {
    await page.goto('http://127.0.0.1:5179' + path);
    await expect(page).toHaveURL(/\/app$/);
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(logouts).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});

test('temporary server failure offers retry without pretending to sign out', async ({ page }) => {
  let unavailable = true;
  await page.route('**/api/**', route => {
    if (unavailable) return route.fulfill({ status: 503, json: { error: 'Temporary outage' } });
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/auth/me') ? { user: { id: 'user', name: 'Farmer' } } : path.endsWith('/farms') ? [] : {} });
  });
  await page.goto('http://127.0.0.1:5179/app/farms');
  await expect(page.getByRole('heading', { name: 'Could not connect' })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'My farms' })).toBeVisible();
});
