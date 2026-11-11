import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plantAppearance } from '../farm3d/growth';
import { seasonReport } from '../utils/seasonReport';
import { SeasonTimeline } from '../components/SeasonTimeline';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlotState, Farm } from '@agritwin/shared';
const state = {
  stage: 'Flowering',
  gdd: 550,
  growth: 0.3,
  stress: 0,
  yieldKg: 2,
  harvestedKg: 0,
} as PlotState;
test('visual growth has flowers before fruit and gradual ripening', () => {
  const flower = plantAppearance('Tomato', state);
  assert.ok(flower.flowers > 0);
  assert.equal(flower.fruit, 0);
  assert.ok(plantAppearance('Tomato', { ...state, gdd: 800 }).fruit > 0);
  assert.ok(plantAppearance('Tomato', { ...state, gdd: 1200 }).ripe > 0);
  assert.equal(plantAppearance('Tomato', { ...state, stage: 'Not planted', gdd: 0 }).emerged, 0);
  assert.equal(
    plantAppearance('Tomato', { ...state, gdd: 2200, growth: 1, harvestedKg: 2 }).leaves,
    0,
  );
});
test('rendering visual stages does not mutate scientific state', () => {
  const frozen = Object.freeze({ ...state });
  plantAppearance('Wheat', frozen);
  assert.equal(frozen.gdd, 550);
});
test('empty timeline is safe and one-day replay is disabled', () => {
  assert.equal(
    renderToStaticMarkup(<SeasonTimeline history={[]} plotId="p" index={-1} onChange={() => {}} />),
    '',
  );
  const html = renderToStaticMarkup(
    <SeasonTimeline
      history={[{ id: 's', date: '2026-01-01', day: 0, version: 0, weather: null, states: [] }]}
      plotId="p"
      index={-1}
      onChange={() => {}}
    />,
  );
  assert.match(html, /disabled/);
  assert.match(html, /Advance the simulation/);
});
test('season reports escape user content and retain provenance', () => {
  const farm = {
    name: '<script>alert(1)</script>',
    location: 'Farm',
    plots: [],
    run: { id: 'r', modelVersion: 'v', history: [], events: [] },
  } as unknown as Farm;
  const html = seasonReport(farm);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Weather provenance'));
});
