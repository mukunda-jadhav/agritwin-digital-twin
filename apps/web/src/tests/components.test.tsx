import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../components/ui/button';
import { moisture, metrics } from '../components/common';
import type { Farm, Snapshot } from '@agritwin/shared';
test('button preserves disabled and accessible action semantics', () => {
  const html = renderToStaticMarkup(
    <Button disabled aria-label="Apply irrigation">
      Apply water
    </Button>,
  );
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-label="Apply irrigation"/);
  assert.match(html, />Apply water<\/button>/);
});
test('moisture labels map root-zone water to bounded available percentage', () => {
  assert.equal(moisture('Loam', 36), 0);
  assert.equal(moisture('Loam', 90), 100);
  assert.equal(moisture('Loam', 63), 50);
  assert.equal(moisture('Loam', 120), 100);
});
test('dashboard aggregates plots by area rather than arithmetic mean', () => {
  const farm = {
      // legacy model version keeps the reference 0.30 m root zone these expected values assume
      run: { modelVersion: 'tomato-educational-v1' },
      plots: [
        { id: 'a', soil: 'Loam', area: 100 },
        { id: 'b', soil: 'Loam', area: 900 },
      ],
    } as Farm,
    s = {
      states: [
        { plotId: 'a', water: 90, growth: 1, stress: 0, waterLitres: 10, yieldKg: 20 },
        { plotId: 'b', water: 36, growth: 0, stress: 1, waterLitres: 30, yieldKg: 40 },
      ],
    } as Snapshot;
  const result = metrics(farm, s);
  assert.equal(result.moisture, 10);
  assert.equal(result.growth, 10);
  assert.equal(result.water, 40);
  assert.equal(result.yield, 60);
});
test('crop health cards render risk, drivers, stage and guidance for every threat', async () => {
  const { ThreatCard } = await import('../components/ThreatCard');
  const { THREATS, assessPlotThreats, CROP_NAMES } = await import('@agritwin/shared');
  const day = {
    date: '2026-08-01',
    temperature: 25,
    rain: 6,
    humidity: 92,
    carried: false,
    progress: 0.4,
    stress: 0.3,
    saturation: 0,
  };
  let rendered = 0;
  for (const crop of CROP_NAMES) {
    const series = Array.from({ length: 7 }, () => ({ ...day }));
    for (const a of assessPlotThreats(crop, series)) {
      const html = renderToStaticMarkup(<ThreatCard a={a} />);
      const threat = THREATS.find((t) => t.id === a.threatId)!;
      assert.ok(html.includes(threat.name.replace(/&/g, '&amp;')), threat.id);
      assert.match(html, /role="meter"/);
      assert.match(html, new RegExp(`aria-valuenow="${a.score}"`));
      assert.ok(html.includes('Symptoms, scouting and management'));
      rendered++;
    }
  }
  assert.equal(
    rendered,
    THREATS.reduce((n, t) => n + Object.keys(t.crops).length, 0),
  );
});
test('local Marathi names are written in Devanagari', async () => {
  const { THREATS } = await import('@agritwin/shared');
  for (const t of THREATS) if (t.local) assert.match(t.local, /^[\u0900-\u097F\s]+$/, t.id);
});
