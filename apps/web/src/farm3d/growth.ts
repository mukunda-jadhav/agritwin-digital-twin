import { cropFor, type PlotState } from '@agritwin/shared';

/** Display-only development. Never feeds values back into the simulation. */
export function plantAppearance(cropName: string | undefined, state: PlotState) {
  const crop = cropFor(cropName);
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const emergence = crop.stages[1]?.gdd || 80;
  const emerged = clamp((state.gdd - emergence * 0.65) / (emergence * 0.6));
  const harvested =
    state.growth >= 1 &&
    ((state.harvestedKg || 0) > 0 || state.harvestReviewed) &&
    state.yieldKg - (state.harvestedKg || 0) < 0.000001;
  return {
    emerged: state.stage === 'Not planted' ? 0 : emerged,
    harvested,
    height: harvested
      ? 0.1
      : crop.maxHeight * Math.max(0.025, clamp(state.growth / 0.68)) * emerged,
    leaves: harvested ? 0 : 2 + clamp(state.growth / 0.55) * 4,
    fruit: harvested ? 0 : clamp((state.gdd - crop.headGdd) / 220),
    ripe: clamp((state.gdd - (crop.name === 'Tomato' ? 1050 : crop.reproductiveGdd)) / 300),
    flowers:
      crop.form === 'fruit' && !harvested
        ? clamp((state.gdd - 450) / 100) * (1 - clamp((state.gdd - 700) / 200))
        : 0,
    stress: clamp(state.stress),
  };
}
