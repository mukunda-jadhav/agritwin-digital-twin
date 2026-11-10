import {
  assessPlotThreats,
  cropFor,
  type Farm,
  type PlotThreatReport,
  type Plot,
  type ThreatDay,
} from '@agritwin/shared';
import { clamp, soilFor } from './engine.js';

/** Days of weather history the risk model looks back over, plus one earlier day for rain carry-over. */
const LOOKBACK = 14;

/**
 * Convert the plot's saved run history into the daily records the risk model needs.
 * Snapshots without provider weather (for example day 0) are skipped.
 */
export function threatSeries(farm: Farm, plot: Plot): ThreatDay[] {
  const crop = cropFor(plot.crop),
    soil = soilFor(plot, true),
    days: ThreatDay[] = [];
  for (const snap of farm.run.history) {
    const w = snap.weather,
      s = snap.states.find((x) => x.plotId === plot.id);
    if (!w || !s || w.source === 'synthetic') continue;
    days.push({
      date: snap.date,
      temperature: w.temperature,
      rain: w.rain,
      humidity: w.humidity,
      carried: w.source === 'carried-forward',
      progress: clamp(s.gdd / crop.maturityGdd),
      stress: s.stress,
      saturation: clamp((s.water - soil.field) / Math.max(1e-9, soil.capacity - soil.field)),
    });
  }
  return days.slice(-LOOKBACK);
}

export function farmThreatReport(farm: Farm): PlotThreatReport[] {
  return farm.plots.map((plot) => {
    const days = threatSeries(farm, plot),
      crop = cropFor(plot.crop).name;
    return {
      plotId: plot.id,
      plotName: plot.name,
      crop,
      asOf: days.length ? days[days.length - 1].date : null,
      weatherDays: days.length,
      assessments: assessPlotThreats(crop, days),
    };
  });
}
