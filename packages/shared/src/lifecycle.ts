import type { Plot, PlotState, Run } from './index';
import { cropFor } from './crops';

export function isMature(run: Run, plot: Plot, state: PlotState) {
  const threshold =
    run.modelVersion === 'tomato-educational-v1' ? 1500 : cropFor(plot.crop).maturityGdd;
  return state.gdd >= threshold || state.growth >= 1;
}
export const remainingYield = (state: PlotState) =>
  Math.max(0, state.yieldKg - (state.harvestedKg || 0));
export function seasonState(run: Run, plots: Plot[]) {
  const states = run.history[run.history.length - 1].states;
  const mature = plots.filter((p) => {
    const s = states.find((s) => s.plotId === p.id);
    return s && isMature(run, p, s);
  });
  const awaitingHarvest = mature.filter((p) => {
    const s = states.find((s) => s.plotId === p.id)!;
    return remainingYield(s) > 0.000001 || (!s.harvestReviewed && (s.harvestedKg || 0) <= 0);
  });
  const complete = plots.length > 0 && mature.length === plots.length;
  return { mature, awaitingHarvest, complete, blocked: complete || awaitingHarvest.length > 0 };
}
