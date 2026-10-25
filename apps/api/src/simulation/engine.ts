import { isMature, seasonState } from '@agritwin/shared';
import { cropFor, cropStage, MODEL_VERSION } from '@agritwin/shared';
import { randomUUID } from 'node:crypto';
import type {
  Farm,
  Plot,
  PlotState,
  Prediction,
  Run,
  Scenario,
  ScenarioInput,
  Snapshot,
  Weather,
} from '@agritwin/shared';
export const SOILS = {
  Loam: { capacity: 135, field: 90, wilt: 36, infiltration: 35, drain: 0.6 },
  Sandy: { capacity: 120, field: 54, wilt: 18, infiltration: 65, drain: 0.85 },
  Clay: { capacity: 150, field: 114, wilt: 60, infiltration: 15, drain: 0.3 },
};
export const CROP = {
  name: 'Tomato',
  version: 'tomato-educational-v1',
  baseTemperature: 10,
  maxTemperature: 30,
  maturityGdd: 1500,
  potentialKgM2: 5,
  rootDepthM: 0.3,
};
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) =>
  Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
export const efficiency = (p: Plot) => ({ Drip: 0.9, Sprinkler: 0.75, Flood: 0.6 })[p.method];
export function soilFor(p: Pick<Plot, 'soil' | 'crop'>, cropRootZone = true) {
  const soil = SOILS[p.soil],
    rootScale = cropRootZone ? cropFor(p.crop).rootDepthM / 0.3 : 1;
  return {
    ...soil,
    capacity: soil.capacity * rootScale,
    field: soil.field * rootScale,
    wilt: soil.wilt * rootScale,
  };
}
export function stage(gdd: number) {
  return gdd < 80
    ? 'Germination'
    : gdd < 450
      ? 'Vegetative'
      : gdd < 700
        ? 'Flowering'
        : gdd < 1200
          ? 'Fruit development'
          : gdd < 1500
            ? 'Maturity'
            : 'Harvest';
}
export const current = (r: Run) => r.history[r.history.length - 1];
export function initialState(p: Plot, date: string): PlotState {
  const water = soilFor(p).field * 0.85;
  return {
    plotId: p.id,
    water,
    gdd: 0,
    age: Math.max(0, daysBetween(p.plantingDate, date)),
    growth: 0,
    stress: 0,
    stressTotal: 0,
    yieldKg: 0,
    waterLitres: 0,
    stage: date < p.plantingDate ? 'Not planted' : 'Germination',
    balance: {
      initial: water,
      rain: 0,
      irrigation: 0,
      loss: 0,
      runoff: 0,
      et: 0,
      drainage: 0,
      final: water,
    },
  };
}
export function newRun(plots: Plot[], date: string): Run {
  return {
    id: randomUUID(),
    modelVersion: MODEL_VERSION,
    status: 'paused',
    speed: 1,
    version: 0,
    history: [
      {
        id: randomUUID(),
        date,
        day: 0,
        version: 0,
        states: plots.map((p) => initialState(p, date)),
        weather: null,
      },
    ],
    events: [],
    weather: [],
  };
}
export function synthetic(date: string, seed = 23): Weather {
  const day = Math.floor(Date.parse(date) / 86400000),
    n = Math.abs(Math.sin(day * 12.9898 + seed * 78.233) * 43758.5453) % 1;
  return {
    date,
    temperature: 25 + 5 * Math.sin(day * 0.12),
    rain: n > 0.82 ? (n - 0.82) * 70 : 0,
    et0: 4.5 + 1.2 * Math.sin(day * 0.09),
    humidity: 55 + n * 25,
    solar: 18 + n * 6,
    source: 'synthetic',
  };
}
export function moisture(p: Plot, s: PlotState, modelVersion = MODEL_VERSION) {
  const soil = soilFor(p, modelVersion === MODEL_VERSION);
  return clamp((s.water - soil.wilt) / (soil.field - soil.wilt)) * 100;
}
export function predict(p: Plot, s: PlotState, rain = 0, modelVersion = MODEL_VERSION): Prediction {
  const soil = soilFor(p, modelVersion === MODEL_VERSION),
    amount =
      s.growth < 1 && moisture(p, s, modelVersion) < 55
        ? Math.min(80, Math.max(0, (soil.field - s.water - rain * 0.8) / efficiency(p)))
        : 0;
  return {
    plotId: p.id,
    amount: Math.round(amount * 10) / 10,
    timing:
      s.growth >= 1
        ? 'Crop maturity reached — record harvest'
        : amount > 0
          ? 'Before the next simulated day'
          : 'No irrigation needed today',
    stress: s.stress > 0.6 ? 'High' : s.stress > 0.25 ? 'Moderate' : 'Low',
    yieldKg: s.yieldKg,
    method: 'Agronomic simulation baseline',
    factors: [
      `${Math.round(moisture(p, s, modelVersion))}% plant-available water`,
      `${s.stage} stage`,
      'Yield is an unvalidated educational estimate',
    ],
  };
}
export function legacyStepPlot(p: Plot, old: PlotState, w: Weather, irrigation = 0): PlotState {
  const soil = soilFor(p, false),
    planted = w.date >= p.plantingDate,
    loss = irrigation * (1 - efficiency(p));
  let runoff = Math.max(0, w.rain - soil.infiltration),
    water = old.water + w.rain - runoff + irrigation - loss;
  runoff += Math.max(0, water - soil.capacity);
  water = Math.min(water, soil.capacity);
  const available = clamp((water - soil.wilt) / (soil.field - soil.wilt)),
    ks = clamp(available / 0.6);
  const kc = !planted
    ? 0.3
    : old.gdd < 80
      ? 0.45
      : old.gdd < 450
        ? 0.75
        : old.gdd < 1200
          ? 1.15
          : 0.8;
  const et = Math.min(water, Math.max(0, w.et0) * kc * ks);
  water -= et;
  const drainage = Math.max(0, water - soil.field) * soil.drain;
  water -= drainage;
  const stress = planted ? clamp(1 - ks + Math.max(0, w.temperature - 32) / 15) : 0;
  const growing = planted && old.gdd < CROP.maturityGdd;
  const gdd =
    old.gdd +
    (growing
      ? Math.max(0, Math.min(CROP.maxTemperature, w.temperature) - CROP.baseTemperature)
      : 0);
  const growth = clamp(
    old.growth +
      (growing
        ? (Math.max(0, Math.min(CROP.maxTemperature, w.temperature) - CROP.baseTemperature) /
            CROP.maturityGdd) *
          (1 - stress * 0.65)
        : 0),
  );
  const age = old.age + (planted ? 1 : 0),
    stressTotal = old.stressTotal + (growing ? stress : 0);
  const yieldKg =
    p.area * CROP.potentialKgM2 * growth * clamp(1 - (stressTotal / Math.max(age, 1)) * 0.7);
  return {
    plotId: p.id,
    water,
    gdd,
    age,
    growth,
    stress,
    stressTotal,
    initialization: old.initialization,
    yieldKg,
    waterLitres: old.waterLitres + irrigation * p.area,
    stage: planted ? stage(gdd) : 'Not planted',
    balance: {
      initial: old.water,
      rain: w.rain,
      irrigation,
      loss,
      runoff,
      et,
      drainage,
      final: water,
    },
  };
}
export function tick(run: Run, plots: Plot[], weather: Weather): Snapshot {
  if (seasonState(run, plots).blocked) {
    run.status = 'paused';
    return current(run);
  }
  const prev = current(run),
    date = addDays(prev.date, 1);
  if (weather.date !== date) throw new Error('Weather date does not match virtual clock');
  const amounts = new Map<string, number>();
  for (const e of run.events) {
    const plot = plots.find((p) => p.id === e.plotId),
      state = prev.states.find((s) => s.plotId === e.plotId);
    if (plot && state && isMature(run, plot, state)) {
      e.enabled = false;
      continue;
    }
    const elapsed = daysBetween(e.date, date);
    if (
      e.enabled &&
      elapsed >= 0 &&
      (elapsed === 0 || (e.interval > 0 && elapsed % e.interval === 0)) &&
      !e.appliedDates.includes(date)
    ) {
      amounts.set(e.plotId, (amounts.get(e.plotId) || 0) + e.amount);
      e.appliedDates.push(date);
      if (!e.interval) e.enabled = false;
    }
  }
  const snap = {
    id: randomUUID(),
    date,
    day: prev.day + 1,
    version: ++run.version,
    weather,
    states: plots.map((p) =>
      isMature(
        run,
        p,
        prev.states.find((s) => s.plotId === p.id)!,
      )
        ? {
            ...prev.states.find((s) => s.plotId === p.id)!,
            balance: {
              initial: prev.states.find((s) => s.plotId === p.id)!.water,
              rain: 0,
              irrigation: 0,
              loss: 0,
              runoff: 0,
              et: 0,
              drainage: 0,
              final: prev.states.find((s) => s.plotId === p.id)!.water,
            },
          }
        : stepPlot(
            p,
            prev.states.find((s) => s.plotId === p.id)!,
            weather,
            amounts.get(p.id) || 0,
            run.modelVersion,
          ),
    ),
  };
  run.history.push(snap);
  if (seasonState(run, plots).blocked) run.status = 'paused';
  for (const e of run.events) {
    const p = plots.find((p) => p.id === e.plotId),
      s = snap.states.find((s) => s.plotId === e.plotId);
    if (p && s && isMature(run, p, s)) e.enabled = false;
  }
  if (!run.weather.some((w) => w.date === date)) run.weather.push(weather);
  return snap;
}
export function irrigate(run: Run, p: Plot, amount: number, id: string) {
  if (run.events.some((e) => e.id === id)) return current(run);
  const snap = structuredClone(current(run));
  snap.id = randomUUID();
  snap.version = ++run.version;
  const s = snap.states.find((s) => s.plotId === p.id)!,
    old = s.water,
    loss = amount * (1 - efficiency(p)),
    soil = soilFor(p, run.modelVersion === MODEL_VERSION),
    runoff = Math.max(0, old + amount - loss - soil.capacity);
  s.water = old + amount - loss - runoff;
  s.waterLitres += amount * p.area;
  s.stress = clamp(1 - clamp((s.water - soil.wilt) / (soil.field - soil.wilt)) / 0.6);
  s.balance = {
    initial: old,
    rain: 0,
    irrigation: amount,
    loss,
    runoff,
    et: 0,
    drainage: 0,
    final: s.water,
  };
  run.events.push({
    id,
    plotId: p.id,
    date: snap.date,
    amount,
    interval: 0,
    enabled: false,
    appliedDates: [snap.date],
    kind: 'manual',
  });
  run.history.push(snap);
  return snap;
}
export function experiment(farm: Farm, config: ScenarioInput, weather: Weather[]): Scenario {
  const start = structuredClone(current(farm.run));
  const a: Run = {
    ...structuredClone(farm.run),
    id: randomUUID(),
    history: [structuredClone(start)],
    events: [],
  };
  const b = structuredClone(a);
  b.id = randomUUID();
  const baseline = [structuredClone(start)],
    experiment = [structuredClone(start)];
  for (let i = 0; i < config.days; i++) {
    for (const p of farm.plots)
      if (i % config.interval === 0) {
        if (
          isMature(
            a,
            p,
            current(a).states.find((s) => s.plotId === p.id)!,
          )
        )
          continue;
        irrigate(a, p, config.amount, randomUUID());
        irrigate(b, p, config.amount * config.irrigationMultiplier, randomUUID());
      }
    const w = weather[i];
    baseline.push(tick(a, farm.plots, w));
    experiment.push(
      tick(b, farm.plots, {
        ...w,
        rain: w.rain * config.rainMultiplier,
        temperature: w.temperature + config.temperatureDelta,
      }),
    );
  }
  return { id: randomUUID(), createdAt: new Date().toISOString(), config, baseline, experiment };
}

export function stepPlot(
  p: Plot,
  old: PlotState,
  w: Weather,
  irrigation = 0,
  version = MODEL_VERSION,
): PlotState {
  if (version === CROP.version) return legacyStepPlot(p, old, w, irrigation);
  const crop = cropFor(p.crop),
    soil = soilFor(p, version === MODEL_VERSION),
    planted = w.date >= p.plantingDate;
  const loss = irrigation * (1 - efficiency(p));
  let runoff = Math.max(0, w.rain - soil.infiltration);
  let water = old.water + w.rain - runoff + irrigation - loss;
  runoff += Math.max(0, water - soil.capacity);
  water = Math.min(water, soil.capacity);
  const available = clamp((water - soil.wilt) / (soil.field - soil.wilt)),
    ks = clamp(available / 0.55),
    progress = clamp(old.gdd / crop.maturityGdd);
  const kc = !planted
    ? 0.3
    : progress < 0.15
      ? crop.kc[0]
      : progress < 0.45
        ? crop.kc[0] + ((crop.kc[1] - crop.kc[0]) * (progress - 0.15)) / 0.3
        : progress < 0.8
          ? crop.kc[1]
          : crop.kc[1] + ((crop.kc[2] - crop.kc[1]) * (progress - 0.8)) / 0.2;
  const et = Math.min(water, Math.max(0, w.et0) * kc * ks);
  water -= et;
  const drainage = Math.max(0, water - soil.field) * soil.drain;
  water -= drainage;
  const stress = planted ? clamp(1 - ks + Math.max(0, w.temperature - crop.heatThreshold) / 15) : 0;
  const growing = planted && old.gdd < crop.maturityGdd,
    heat = Math.max(0, Math.min(crop.maxTemperature, w.temperature) - crop.baseTemperature);
  const gdd = Math.min(crop.maturityGdd, old.gdd + (growing ? heat : 0)),
    growth = clamp(gdd / crop.maturityGdd),
    age = old.age + (planted ? 1 : 0),
    stressTotal = old.stressTotal + (growing ? stress : 0);
  const lai =
      crop.maxLai * Math.min(1, growth / 0.45) * (growth > 0.85 ? 1 - (growth - 0.85) * 3 : 1),
    intercepted = 1 - Math.exp(-0.6 * lai);
  const biomassKgM2 =
    (old.biomassKgM2 || 0) +
    (growing ? ((Math.max(0, w.solar) * 0.48 * intercepted * crop.rue) / 1000) * (1 - stress) : 0);
  const fruitFraction = clamp(
    (gdd - crop.reproductiveGdd) / (crop.maturityGdd - crop.reproductiveGdd),
  );
  const produced =
    p.area *
    Math.min(crop.potentialKgM2, (biomassKgM2 * crop.harvestIndex) / crop.dryMatterFraction) *
    fruitFraction;
  return {
    plotId: p.id,
    water,
    gdd,
    age,
    growth,
    stress,
    stressTotal,
    biomassKgM2,
    initialization: old.initialization,
    harvestedKg: old.harvestedKg || 0,
    yieldKg: Math.max(old.yieldKg, produced),
    waterLitres: old.waterLitres + irrigation * p.area,
    stage: planted ? cropStage(crop, gdd) : 'Not planted',
    balance: {
      initial: old.water,
      rain: w.rain,
      irrigation,
      loss,
      runoff,
      et,
      drainage,
      final: water,
    },
  };
}
export function harvest(run: Run, plot: Plot, kg: number, id: string) {
  if (run.harvests?.some((e) => e.id === id)) return current(run);
  const crop = cropFor(plot.crop),
    snap = structuredClone(current(run)),
    state = snap.states.find((s) => s.plotId === plot.id)!;
  if (state.gdd < (run.modelVersion === CROP.version ? 1500 : crop.harvestGdd))
    throw new Error('The crop has not reached its harvest stage.');
  const available = Math.max(0, state.yieldKg - (state.harvestedKg || 0));
  if (kg === 0 && available <= 0.000001 && isMature(run, plot, state)) {
    if (state.harvestReviewed) return current(run);
    state.harvestReviewed = true;
    snap.id = randomUUID();
    snap.version = ++run.version;
    run.history.push(snap);
    return snap;
  }
  if (kg <= 0 || kg > available + 0.000001)
    throw new Error('Harvest amount exceeds the simulated available yield.');
  state.harvestedKg = (state.harvestedKg || 0) + kg;
  if (isMature(run, plot, state) && state.yieldKg - state.harvestedKg <= 0.000001)
    state.harvestReviewed = true;
  snap.id = randomUUID();
  snap.version = ++run.version;
  run.harvests ??= [];
  run.harvests.push({ id, plotId: plot.id, date: snap.date, kg });
  run.history.push(snap);
  return snap;
}
