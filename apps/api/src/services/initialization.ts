import type { Farm, PlotState } from '@agritwin/shared';
import { MODEL_VERSION } from '@agritwin/shared';
import { randomUUID } from 'node:crypto';
import { addDays, current, soilFor, stepPlot } from '../simulation/engine.js';
import { weatherFor, providerSoilWater, requireWeatherCoverage } from './weather.js';
/** Bare-soil spin-up. The spread is sensitivity to the unknown initial condition, not statistical confidence. */
export async function initializeSoil(farm: Farm) {
  const snap = current(farm.run);
  if (snap.day !== 0 || farm.run.events.length || snap.states.every((s) => s.initialization))
    return;
  const start = addDays(snap.date, -30);
  const weather = await weatherFor(farm, start, 30);
  requireWeatherCoverage(weather, start, 30);
  for (const record of weather)
    if (!farm.run.weather.some((saved) => saved.date === record.date))
      farm.run.weather.push(record);
  const states = await Promise.all(
    snap.states.map(async (state) => {
      const p = farm.plots.find((p) => p.id === state.plotId)!;
      const soil = soilFor(p, farm.run.modelVersion === MODEL_VERSION);
      const results = [0.2, 0.6, 1].map((fraction) => {
        let s: PlotState = { ...state, water: soil.wilt + fraction * (soil.field - soil.wilt) };
        // No crop is assumed before the run starts; irrigation history is unknown.
        for (const day of weather)
          s = stepPlot({ ...p, plantingDate: snap.date }, s, day, 0, farm.run.modelVersion);
        return s.water;
      });
      const grid = await providerSoilWater(farm, addDays(snap.date, -1), p.soil, soil);
      const water = grid?.water ?? results[1];
      return {
        ...state,
        water,
        balance: { ...state.balance, initial: water, final: water },
        initialization: {
          method: grid
            ? 'Provider gridded soil-moisture estimate'
            : '30-day bare-soil weather spin-up',
          from: start,
          to: addDays(snap.date, -1),
          source: grid?.source || weather[0].provider || weather[0].source,
          fetchedAt: weather[0].fetchedAt,
          lowerMm: Math.min(water, ...results),
          upperMm: Math.max(water, ...results),
          assumption: grid
            ? 'Soil moisture is a gridded reanalysis estimate converted using the selected soil class and crop root zone. It is not a field measurement.'
            : 'No previous irrigation; initial available water explored at 20%, 60% and 100%. Range is model sensitivity, not measured accuracy.',
        },
      };
    }),
  );
  farm.run.version++;
  farm.run.history.push({ ...snap, id: randomUUID(), version: farm.run.version, states });
}
