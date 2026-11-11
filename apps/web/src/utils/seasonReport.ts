import type { Farm } from '@agritwin/shared';

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function seasonReport(farm: Farm) {
  const esc = escapeHtml;
  const rows = farm.run.history
    .flatMap((s) =>
      s.states.map(
        (p) =>
          `<tr><td>${esc(s.date)}</td><td>${esc(farm.plots.find((x) => x.id === p.plotId)?.name)}</td><td>${esc(p.stage)}</td><td>${p.water.toFixed(1)}</td><td>${(p.stress * 100).toFixed(1)}</td><td>${p.yieldKg.toFixed(1)}</td><td>${esc(s.weather?.source || 'Unavailable')}</td></tr>`,
      ),
    )
    .join('');
  const charts = farm.plots
    .map((plot) => {
      const states = farm.run.history.map((s) => s.states.find((p) => p.plotId === plot.id)!);
      const points = (key: 'growth' | 'stress') =>
        states
          .map(
            (s, i) =>
              `${20 + (i / Math.max(1, states.length - 1)) * 560},${170 - Math.max(0, Math.min(1, s[key])) * 140}`,
          )
          .join(' ');
      return `<h3>${esc(plot.name)} — growth and stress</h3><svg viewBox="0 0 600 195" role="img" aria-label="Growth in green and stress in orange across saved days"><path d="M20 20V170H580" fill="none" stroke="#aaa"/><polyline points="${points('growth')}" fill="none" stroke="#246a48" stroke-width="3"/><polyline points="${points('stress')}" fill="none" stroke="#b75d20" stroke-dasharray="6 4" stroke-width="3"/><text x="20" y="190">First saved day</text><text x="470" y="190">Last saved day</text></svg><p>Solid green: growth · Dashed orange: stress · Vertical scale: 0–100%</p>`;
    })
    .join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(farm.name)} — Season report</title><style>body{font:16px/1.6 system-ui;color:#243b2e;max-width:1000px;margin:40px auto;padding:20px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}svg{max-width:650px;width:100%}h2{margin-top:36px}tr{break-inside:avoid}@media print{body{margin:0;padding:0}}</style><h1>${esc(farm.name)} — Season report</h1><p>${esc(farm.location)} · Model: ${esc(farm.run.modelVersion)} · Run: ${esc(farm.run.id)}</p><p>Educational model estimates, not field measurements or guaranteed outcomes. Weather provenance is shown per day. Carried-forward weather is not a new observation. Field notes do not calibrate the model automatically.</p><h2>Field inputs</h2><ul>${farm.plots.map((p) => `<li>${esc(p.name)}: ${esc(p.crop || 'Tomato')}, ${esc(p.area)} m², ${esc(p.soil)}, ${esc(p.method)}, planted ${esc(p.plantingDate)}</li>`).join('')}</ul><h2>Season trends</h2>${charts}<h2>Watering records</h2><ul>${farm.run.events.map((e) => `<li>${esc(e.date)} · ${esc(e.plotId)} · ${esc(e.amount)} mm · ${esc(e.kind)} · Applied: ${esc(e.appliedDates.join(', '))}</li>`).join('') || '<li>No watering recorded.</li>'}</ul><h2>Field observations</h2><ul>${
    (farm.observations || [])
      .filter((o) => o.runId === farm.run.id)
      .map(
        (o) =>
          `<li>${esc(o.date)} · ${esc(o.plotId)} · Observed stage: ${esc(o.stage || 'Not recorded')} · Modeled: ${esc(o.modeledStage)} · Height: ${esc(o.heightCm ?? 'Not recorded')} cm · Actual cumulative harvest: ${esc(o.harvestedKg ?? 'Not recorded')} kg · Modeled cumulative harvest: ${esc(o.modeledHarvestKg)} kg · ${esc(o.note)}</li>`,
      )
      .join('') || '<li>No observations recorded.</li>'
  }</ul><h2>Saved daily estimates</h2><table><thead><tr><th>Date</th><th>Plot</th><th>Stage</th><th>Root-zone water mm</th><th>Stress %</th><th>Yield kg</th><th>Weather source</th></tr></thead><tbody>${rows}</tbody></table></html>`;
}
export function downloadSeasonReport(farm: Farm) {
  const url = URL.createObjectURL(
    new Blob([seasonReport(farm)], { type: 'text/html;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `agritwin-season-${farm.run.id}.html`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
