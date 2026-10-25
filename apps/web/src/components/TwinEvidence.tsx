import type { Farm, Snapshot, Weather } from '@agritwin/shared';
import { t } from '../i18n';
export function TwinEvidence({
  farm,
  snapshot,
  weather,
}: {
  farm: Farm;
  snapshot: Snapshot;
  weather?: Weather;
}) {
  const legacy = farm.run.history.some((s) => s.weather?.source === 'synthetic');
  return (
    <details className="twin-evidence">
      <summary>
        <strong>{t('Twin data & assumptions')}</strong>
        <span>
          {t('Weather source')} · {t('Crop and soil water are model estimates')}
        </span>
      </summary>
      <div className="evidence-body">
        {legacy && (
          <p className="notice">
            {t(
              'This older saved run contains generated weather. New simulation days use provider weather or carry forward the latest provider record.',
            )}
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('Twin input')}</th>
                <th>{t('Source')}</th>
                <th>{t('Meaning')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Weather')}</td>
                <td>
                  {weather?.provider || (weather ? 'Provider source not recorded' : 'Unavailable')}
                </td>
                <td>
                  {weather
                    ? `${weather.date} · ${weather.source}${weather.sourceDate ? ` · ${t('reused from')} ${weather.sourceDate}` : ''}`
                    : t('No values available')}
                </td>
              </tr>
              <tr>
                <td>{t('Farm & crop configuration')}</td>
                <td>{t('Farmer entered')}</td>
                <td>{t('Location, area, crop, soil class and irrigation method')}</td>
              </tr>
              <tr>
                <td>{t('Initial soil water')}</td>
                <td>{t('Model assumption')}</td>
                <td>
                  {snapshot.states[0]?.initialization
                    ? `${snapshot.states[0].initialization.method} · ${snapshot.states[0].initialization.from} to ${snapshot.states[0].initialization.to}. ${snapshot.states[0].initialization.assumption}`
                    : t('85% of field capacity at initialization; not a soil measurement')}
                </td>
              </tr>
              <tr>
                <td>{t('Growth, soil water & yield')}</td>
                <td>{farm.run.modelVersion}</td>
                <td>{t('Calculated from the saved state and inputs; not measured')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {snapshot.states.some((s) => s.initialization) && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Plot</th>
                  <th>Starting water sensitivity</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.states
                  .filter((s) => s.initialization)
                  .map((s) => (
                    <tr key={s.plotId}>
                      <td>{farm.plots.find((p) => p.id === s.plotId)?.name}</td>
                      <td>
                        {s.initialization!.lowerMm.toFixed(1)}–
                        {s.initialization!.upperMm.toFixed(1)} mm
                      </td>
                      <td>{s.initialization!.source}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p>
              This range applies to the starting date only. It is not a confidence interval or a
              current sensor reading.
            </p>
          </div>
        )}
        <p>
          {t('Input retrieved')}:{' '}
          {weather?.fetchedAt ? new Date(weather.fetchedAt).toLocaleString() : t('Not recorded')} ·{' '}
          {t('Simulation day')}: {snapshot.day} · UTC
        </p>
        <p>
          {t(
            'Weather forecasts are uncertain. Historical reanalysis is a weather-model dataset. Neither measures the water in your soil.',
          )}
        </p>
      </div>
    </details>
  );
}
