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
