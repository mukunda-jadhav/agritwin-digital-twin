import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CROP_NAMES,
  CROPS,
  THREATS,
  assessPlotThreats,
  assessThreat,
  riskLevel,
  threatsForCrop,
  type Farm,
  type Plot,
  type ThreatDay,
  type Weather,
} from '@agritwin/shared';
import { addDays, newRun, tick } from '../simulation/engine.js';
import { farmThreatReport, threatSeries } from '../simulation/threats.js';

const find = (id: string) => THREATS.find((t) => t.id === id)!;
const days = (n: number, over: Partial<ThreatDay> = {}): ThreatDay[] =>
  Array.from({ length: n }, (_, i) => ({
    date: addDays('2026-07-01', i),
    temperature: 25,
    rain: 0,
    humidity: 60,
    carried: false,
    progress: 0.4,
    stress: 0,
    saturation: 0,
    ...over,
  }));

test('knowledge base is complete and internally consistent', () => {
  const ids = new Set<string>();
  for (const t of THREATS) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.ok(
      t.temp.min < t.temp.optLow && t.temp.optLow <= t.temp.optHigh && t.temp.optHigh < t.temp.max,
      t.id,
    );
    if (t.humidity) assert.ok(t.humidity.min < t.humidity.full && t.humidity.full <= 100, t.id);
    assert.ok(t.mode !== 'wet' || t.humidity, `${t.id}: wet-weather threats need a humidity range`);
    assert.ok(t.symptoms.length > 20 && t.scouting.length > 15 && t.management.length >= 2, t.id);
    for (const [crop, [a, b]] of Object.entries(t.crops)) {
      assert.ok(crop in CROPS, `${t.id}: unknown crop ${crop}`);
      assert.ok(a >= 0 && b <= 1 && a < b, `${t.id}: bad window for ${crop}`);
    }
  }
});

test('every supported crop has disease and pest coverage including both kinds', () => {
  for (const crop of CROP_NAMES) {
    const list = threatsForCrop(crop);
    assert.ok(list.length >= 2, `${crop} has too few threats`);
    assert.ok(
      list.some((t) => t.kind === 'insect'),
      `${crop} has no pest`,
    );
    assert.ok(
      list.some((t) => t.kind !== 'insect'),
      `${crop} has no disease`,
    );
  }
});

test('late blight is high in cool, humid, rainy weather and low in hot dry weather', () => {
  const lb = find('tomato-late-blight');
  const cool = assessThreat(lb, 'Tomato', days(7, { temperature: 16, humidity: 93, rain: 6 }));
  const hot = assessThreat(lb, 'Tomato', days(7, { temperature: 34, humidity: 40, rain: 0 }));
  assert.ok(cool.score >= 70, `cool score ${cool.score}`);
  assert.equal(cool.level, 'Very high');
  assert.equal(hot.score, 0);
  assert.equal(hot.level, 'Low');
});

test('whitefly-spread virus favours hot, dry weather over cool, humid weather', () => {
  const v = find('tomato-leaf-curl');
  const hotDry = assessThreat(
    v,
    'Tomato',
    days(7, { temperature: 30, humidity: 40, progress: 0.15 }),
  );
  const coolWet = assessThreat(
    v,
    'Tomato',
    days(7, { temperature: 21, humidity: 92, rain: 8, progress: 0.15 }),
  );
  assert.ok(hotDry.score > coolWet.score + 40);
});

test('no risk is reported outside the susceptible crop stage', () => {
  const rust = find('wheat-leaf-rust');
  const early = assessThreat(
    rust,
    'Wheat',
    days(7, { temperature: 18, humidity: 90, rain: 5, progress: 0.02 }),
  );
  const late = assessThreat(
    rust,
    'Wheat',
    days(7, { temperature: 18, humidity: 90, rain: 5, progress: 0.98 }),
  );
  for (const r of [early, late]) {
    assert.equal(r.status, 'outside-stage');
    assert.equal(r.score, 0);
    assert.equal(r.level, 'Low');
  }
  assert.match(early.drivers[0], /not yet reached/);
  assert.match(late.drivers[0], /passed/);
});

test('water stress raises charcoal rot risk', () => {
  const cr = find('jowar-charcoal-rot');
  const base = { temperature: 33, humidity: 40, progress: 0.7 };
  const calm = assessThreat(cr, 'Jowar', days(7, { ...base, stress: 0 }));
  const stressed = assessThreat(cr, 'Jowar', days(7, { ...base, stress: 1 }));
  assert.ok(stressed.score > calm.score);
  assert.ok(stressed.drivers.some((d) => /water stress/i.test(d)));
});

test('waterlogging raises Phytophthora blight risk', () => {
  const pb = find('tur-phytophthora-blight');
  const base = { temperature: 27, humidity: 90, rain: 10, progress: 0.2 };
  const dry = assessThreat(pb, 'Tur', days(7, { ...base, saturation: 0 }));
  const soggy = assessThreat(pb, 'Tur', days(7, { ...base, saturation: 1 }));
  assert.ok(soggy.score > dry.score);
});

test('not enough weather is flagged rather than guessed', () => {
  const none = assessThreat(find('rice-blast'), 'Rice', []);
  assert.equal(none.status, 'insufficient-weather');
  assert.equal(none.score, 0);
  const short = assessThreat(
    find('rice-blast'),
    'Rice',
    days(2, { temperature: 24, humidity: 92, rain: 6, progress: 0.3 }),
  );
  assert.equal(short.status, 'insufficient-weather');
});

test('carried-forward weather lowers confidence and is disclosed', () => {
  const r = assessThreat(
    find('rice-blast'),
    'Rice',
    days(7, { temperature: 24, humidity: 92, rain: 0, progress: 0.3, carried: true }),
  );
  assert.equal(r.carriedDays, 7);
  assert.ok(r.drivers.some((d) => /carried forward/.test(d)));
});

test('scores are always integers from 0 to 100 and levels match thresholds', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (const crop of CROP_NAMES) {
    for (let run = 0; run < 40; run++) {
      const series = days(1 + Math.floor(rnd() * 14)).map((d) => ({
        ...d,
        temperature: -5 + rnd() * 55,
        rain: rnd() < 0.4 ? rnd() * 80 : 0,
        humidity: rnd() * 100,
        progress: rnd(),
        stress: rnd(),
        saturation: rnd(),
        carried: rnd() < 0.2,
      }));
      for (const a of assessPlotThreats(crop, series)) {
        assert.ok(
          Number.isInteger(a.score) && a.score >= 0 && a.score <= 100,
          `${a.threatId} ${a.score}`,
        );
        assert.equal(a.level, riskLevel(a.score));
        assert.ok(a.trend.every((v) => Number.isInteger(v) && v >= 0 && v <= 100));
      }
    }
  }
  assert.deepEqual([24, 25, 49, 50, 69, 70].map(riskLevel), [
    'Low',
    'Moderate',
    'Moderate',
    'High',
    'High',
    'Very high',
  ]);
});

test('assessments are sorted highest risk first and trend has one value per day (max 7)', () => {
  const list = assessPlotThreats(
    'Rice',
    days(10, { temperature: 25, humidity: 92, rain: 6, progress: 0.3 }),
  );
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score);
  assert.equal(list[0].trend.length, 7);
});

test('a threat cannot be assessed for a crop it does not attack', () => {
  assert.throws(() => assessThreat(find('rice-blast'), 'Wheat', days(5)));
});

test('farm report is built from saved provider weather only and is deterministic', () => {
  const plot: Plot = {
    id: 'p1',
    name: 'North',
    area: 1000,
    soil: 'Loam',
    method: 'Drip',
    plantingDate: '2026-07-01',
    crop: 'Rice',
  };
  const run = newRun([plot], '2026-07-01');
  const weather = (date: string, over: Partial<Weather> = {}): Weather => ({
    date,
    temperature: 25,
    rain: 6,
    et0: 3.5,
    humidity: 92,
    solar: 16,
    source: 'historical',
    ...over,
  });
  for (let i = 1; i <= 25; i++) tick(run, [plot], weather(addDays('2026-07-01', i)));
  const farm = { plots: [plot], run } as unknown as Farm;
  const a = farmThreatReport(farm),
    b = farmThreatReport(structuredClone(farm));
  assert.deepEqual(a, b);
  assert.equal(a[0].crop, 'Rice');
  assert.ok(a[0].weatherDays > 0 && a[0].weatherDays <= 14);
  assert.equal(a[0].asOf, '2026-07-26');
  assert.ok(a[0].assessments.length >= 4);

  // generated weather is never used as evidence
  const fake = newRun([plot], '2026-07-01');
  tick(fake, [plot], weather('2026-07-02', { source: 'synthetic' }));
  assert.equal(threatSeries({ plots: [plot], run: fake } as unknown as Farm, plot).length, 0);
});

test('weather alone cannot make a pest read Very high, but can for weather-driven disease', () => {
  const ideal = (over: Partial<ThreatDay>) => days(7, { humidity: 90, rain: 6, ...over });
  const insectNeutral = assessThreat(
    find('cotton-pink-bollworm'),
    'Cotton',
    ideal({ temperature: 28, progress: 0.6 }),
  );
  const insectWet = assessThreat(
    find('rice-planthopper'),
    'Rice',
    ideal({ temperature: 27, progress: 0.5 }),
  );
  const vector = assessThreat(
    find('tomato-leaf-curl'),
    'Tomato',
    days(7, { temperature: 30, humidity: 35, progress: 0.15, stress: 1 }),
  );
  const fungal = assessThreat(
    find('rice-blast'),
    'Rice',
    ideal({ temperature: 24, humidity: 96, progress: 0.3 }),
  );
  assert.ok(
    insectNeutral.score <= 45 &&
      insectNeutral.level !== 'High' &&
      insectNeutral.level !== 'Very high',
  );
  assert.ok(insectWet.score <= 65 && insectWet.level !== 'Very high');
  assert.ok(vector.score <= 65 && vector.level !== 'Very high');
  assert.equal(fungal.level, 'Very high');
  assert.ok(insectNeutral.drivers.some((d) => /not how many are present/.test(d)));
  assert.ok(!fungal.drivers.some((d) => /not how many are present/.test(d)));
});
