import { test } from '@playwright/test';
import assert from 'node:assert/strict';

// API fixtures keep this UI test independent of user farms and external weather.
test('field workspace, replay, notebook and scenario comparison', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const plots = [
    {
      id: 'p1',
      name: 'Tomato field',
      area: 200,
      soil: 'Loam',
      method: 'Drip',
      plantingDate: '2026-01-01',
      crop: 'Tomato',
    },
    {
      id: 'p2',
      name: 'Wheat field',
      area: 200,
      soil: 'Loam',
      method: 'Drip',
      plantingDate: '2026-01-01',
      crop: 'Wheat',
    },
  ];
  const history = Array.from({ length: 40 }, (_, i) => ({
    id: 's' + i,
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    day: i,
    version: i,
    weather: {
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      temperature: 25,
      rain: i % 5 === 0 ? 12 : 0,
      humidity: 65,
      solar: 18,
      et0: 4,
      source: 'historical',
    },
    states: plots.map((p) => ({
      plotId: p.id,
      water: 100 - i,
      gdd: i * 35,
      age: i,
      growth: i / 45,
      stress: i / 100,
      stressTotal: i / 10,
      yieldKg: i * 3,
      waterLitres: i * 100,
      stage:
        i < 3
          ? 'Germination'
          : i < 14
            ? 'Vegetative growth'
            : i < 22
              ? 'Flowering'
              : 'Fruit development',
      balance: {
        initial: 110,
        rain: 0,
        irrigation: 10,
        loss: 1,
        runoff: 0,
        et: 4,
        drainage: 1,
        final: 100 - i,
      },
    })),
  }));
  const scenario = {
    id: 'scenario',
    createdAt: '2026-01-01',
    config: {
      name: '25% less irrigation',
      days: 39,
      rainMultiplier: 1,
      temperatureDelta: 0,
      irrigationMultiplier: 0.75,
      interval: 2,
      amount: 15,
    },
    baseline: history,
    experiment: history.map((s) => ({
      ...s,
      states: s.states.map((p) => ({
        ...p,
        water: p.water * 0.8,
        stress: p.stress * 1.5,
        waterLitres: p.waterLitres * 0.75,
      })),
    })),
  };
  let farm = {
    id: 'farm',
    ownerId: 'user',
    name: 'Green Valley Farm',
    location: 'Pune, Maharashtra',
    latitude: 18.52,
    longitude: 73.85,
    area: 400,
    unit: 'm²',
    plots,
    run: {
      id: 'run',
      modelVersion: 'agritwin-maharashtra-v3',
      status: 'paused',
      speed: 1,
      version: 39,
      history,
      weather: history.map((s) => s.weather),
      events: [],
    },
    scenarios: [scenario],
    archives: [],
    observations: [],
    createdAt: '2026-01-01',
  };
  await page.route('**/socket.io/**', (r) => r.abort());
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path.endsWith('/auth/me'))
      data = { user: { id: 'user', name: 'Demo farmer', email: 'demo@example.com' } };
    else if (path.endsWith('/health')) data = { storage: 'local-file' };
    else if (path.endsWith('/weather')) data = farm.run.weather;
    else if (path.endsWith('/predictions'))
      data = plots.map((p) => ({
        plotId: p.id,
        amount: 10,
        stress: 'Moderate',
        yieldKg: 100,
        method: 'Model',
        factors: [],
      }));
    else if (path.endsWith('/scenarios')) data = scenario;
    else if (path.endsWith('/observations')) {
      const b = route.request().postDataJSON();
      farm = {
        ...farm,
        observations: [
          {
            ...b,
            createdAt: '2026-02-01',
            modelVersion: farm.run.modelVersion,
            snapshotId: 's39',
            modeledStage: 'Fruit development',
            modeledHarvestKg: 0,
          },
        ],
      };
      data = farm;
    } else if (path.endsWith('/farms')) data = [farm];
    else data = farm;
    await route.fulfill({ json: data });
  });
  await page.goto('http://127.0.0.1:5179/app');
  await page.getByRole('heading', { name: 'Green Valley Farm' }).waitFor();
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Look under soil' }).click();
  await page.getByRole('heading', { name: 'Under the soil' }).waitFor();
  await page.getByRole('button', { name: 'Play growth', exact: true }).click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  assert.ok(
    Number(await page.getByRole('slider', { name: 'Choose a saved day' }).inputValue()) >= 1,
  );
  await page.getByRole('button', { name: 'Back to today' }).click();
  await page.getByText('Add a field observation', { exact: false }).click();
  await page.getByLabel('Measured plant height (cm)').fill('35');
  await page.getByLabel('What did you notice?').fill('Healthy leaves');
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await page.getByText('Observation saved', { exact: true }).waitFor();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download season report' }).click();
  assert.ok((await dl).suggestedFilename().endsWith('.html'));
  await page.getByRole('link', { name: 'Scenario analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
  await page.getByRole('heading', { name: 'Watch both choices' }).waitFor();
  await page.locator('canvas').nth(1).waitFor();
  assert.equal(await page.locator('canvas').count(), 2);
  await page.getByLabel('Camera', { exact: true }).selectOption('close');
  await page.getByRole('slider', { name: 'Choose a saved day' }).fill('30');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('scenarios.png'), fullPage: true });
  await page.goto('http://127.0.0.1:5179/app');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('heading', { name: 'Green Valley Farm' }).waitFor();
  await page.waitForTimeout(1000);
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'Mobile horizontal overflow',
  );
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Crop close-up', exact: true }).click();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('mr');
  await page.getByRole('button', { name: 'वाढ पाहा', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: desktop, WebGL, replay, soil cutaway, notebook, export, scenario fields, mobile overflow, reduced motion.',
  );
});
