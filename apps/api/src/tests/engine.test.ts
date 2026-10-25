import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Farm, Plot } from '@agritwin/shared';
import {
  SOILS,
  addDays,
  current,
  experiment,
  initialState,
  irrigate,
  newRun,
  stepPlot,
  synthetic,
  tick,
} from '../simulation/engine.js';
const plot: Plot = {
  id: 'p1',
  name: 'Test field',
  area: 1000,
  soil: 'Loam',
  method: 'Drip',
  plantingDate: '2026-01-01',
};
test('conserves water under all soils, flooding, heat and prolonged drought', () => {
  for (const soil of ['Loam', 'Sandy', 'Clay'] as const) {
    const p = { ...plot, soil };
    let state = initialState(p, p.plantingDate);
    for (let d = 1; d <= 365; d++) {
      const w = synthetic(addDays(p.plantingDate, d));
      w.rain = d % 17 === 0 ? 200 : 0;
      w.et0 = d % 3 === 0 ? 20 : 4;
      state = stepPlot(p, state, w, d % 31 === 0 ? 100 : 0);
      const b = state.balance;
      assert.ok(
        Math.abs(
          b.initial + b.rain + b.irrigation - b.loss - b.runoff - b.et - b.drainage - b.final,
        ) < 1e-9,
      );
      assert.ok(state.water >= 0 && state.water <= SOILS[soil].capacity);
      assert.ok(state.growth >= 0 && state.growth <= 1);
    }
  }
});
test('saved weather produces identical physical states on replay', () => {
  const a = newRun([plot], plot.plantingDate),
    b = newRun([plot], plot.plantingDate);
  for (let i = 1; i <= 100; i++) {
    const w = synthetic(addDays(plot.plantingDate, i));
    tick(a, [plot], w);
    tick(b, [plot], structuredClone(w));
  }
  assert.deepEqual(current(a).states, current(b).states);
});
test('irrigation is idempotent and tracks gross use and efficiency', () => {
  const run = newRun([plot], plot.plantingDate),
    start = current(run).states[0].water;
  irrigate(run, plot, 10, 'request-1');
  assert.equal(current(run).states[0].water, start + 9);
  assert.equal(current(run).states[0].waterLitres, 10000);
  const version = run.version;
  irrigate(run, plot, 10, 'request-1');
  assert.equal(run.version, version);
});
test('scheduled irrigation occurs once on due dates', () => {
  const run = newRun([plot], plot.plantingDate);
  run.events.push({
    id: 'event',
    plotId: plot.id,
    date: '2026-01-02',
    amount: 10,
    interval: 2,
    enabled: true,
    appliedDates: [],
    kind: 'schedule',
  });
  for (let i = 1; i <= 5; i++) tick(run, [plot], synthetic(addDays(plot.plantingDate, i)));
  assert.deepEqual(run.events[0].appliedDates, ['2026-01-02', '2026-01-04', '2026-01-06']);
  assert.equal(current(run).states[0].waterLitres, 30000);
});
test('scenario has paired initial states and leaves source untouched', () => {
  const farm = { plots: [plot], run: newRun([plot], plot.plantingDate) } as Farm,
    before = JSON.stringify(farm);
  const scenario = experiment(
    farm,
    {
      name: 'Dry',
      days: 30,
      rainMultiplier: 1,
      temperatureDelta: 0,
      irrigationMultiplier: 0,
      interval: 2,
      amount: 15,
    },
    Array.from({ length: 30 }, (_, i) => ({
      ...synthetic(addDays(plot.plantingDate, i + 1)),
      rain: 0,
    })),
  );
  assert.equal(JSON.stringify(farm), before);
  assert.deepEqual(scenario.baseline[0], scenario.experiment[0]);
  assert.ok(
    scenario.baseline.at(-1)!.states[0].waterLitres >
      scenario.experiment.at(-1)!.states[0].waterLitres,
  );
  assert.ok(
    scenario.baseline.at(-1)!.states[0].yieldKg > scenario.experiment.at(-1)!.states[0].yieldKg,
  );
});
test('future planting does not accumulate growth before planting', () => {
  const p = { ...plot, plantingDate: '2026-02-01' },
    s = stepPlot(p, initialState(p, '2026-01-01'), synthetic('2026-01-02'));
  assert.equal(s.gdd, 0);
  assert.equal(s.growth, 0);
  assert.equal(s.stage, 'Not planted');
});
