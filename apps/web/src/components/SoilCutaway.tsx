import { cropFor, MODEL_VERSION, type Plot, type PlotState } from '@agritwin/shared';
import { t } from '../i18n';
import { fmt, plotMoisture } from './common';

export function SoilCutaway({
  plot,
  state,
  modelVersion,
}: {
  plot: Plot;
  state: PlotState;
  modelVersion: string;
}) {
  const water = plotMoisture(plot, state.water, modelVersion);
  return (
    <section className="soil-cutaway">
      <div>
        <h3>{t('Under the soil')}</h3>
        <p className="muted">{t('Illustration of the root zone, not a measurement.')}</p>
      </div>
      <div
        className="soil-diagram"
        role="img"
        aria-label={`${t('Available soil water')}: ${fmt(water)}%. ${t('Root zone')}: ${modelVersion === MODEL_VERSION ? cropFor(plot.crop).rootDepthM : 0.3} m`}
      >
        <div className="soil-grass" />
        <div className="soil-water-fill" style={{ height: `${water * 0.72}%` }} />
        <svg viewBox="0 0 360 160" aria-hidden="true">
          <g stroke="#f4ddb1" strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M180 0 Q170 60 185 142 M178 35 Q140 50 115 95 M177 55 Q210 70 245 110 M178 82 Q148 98 145 130 M184 108 Q208 117 218 145 M145 58 L130 80 M215 83 L220 105" />
          </g>
        </svg>
        <span className="soil-water-label">
          {fmt(water)}% {t('Available soil water').toLowerCase()}
        </span>
      </div>
      <div className="water-balance-grid">
        {[
          ['Rainfall', state.balance.rain, '↓'],
          ['Water added', state.balance.irrigation, '↓'],
          ['Used by soil and crop', state.balance.et, '↑'],
          ['Runoff', state.balance.runoff, '→'],
          ['Drainage', state.balance.drainage, '↓'],
        ].map(([label, value, arrow]) => (
          <div key={String(label)}>
            <span>
              {arrow} {t(String(label))}
            </span>
            <strong>{fmt(Number(value), 1)} mm</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
