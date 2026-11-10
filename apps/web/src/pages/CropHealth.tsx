import { useEffect, useState } from 'react';
import { Bug, ShieldAlert } from 'lucide-react';
import type { PlotThreatReport } from '@agritwin/shared';
import { ThreatCard, threatById } from '../components/ThreatCard';
import { useFarm } from '../stores/useFarm';
import { api } from '../services/api';
import { dateLabel } from '../components/common';
import { t } from '../i18n';

export function CropHealth() {
  const { farm, selected, select } = useFarm(),
    [reports, setReports] = useState<PlotThreatReport[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!farm) return;
    let active = true;
    setLoading(true);
    api<{ plots: PlotThreatReport[] }>(`/farms/${farm.id}/threats`)
      .then((r) => {
        if (active) {
          setReports(r.plots);
          setError('');
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [farm?.id, farm?.run.version]);
  if (!farm) return null;
  const plot = farm.plots.find((p) => p.id === selected) || farm.plots[0],
    report = reports.find((r) => r.plotId === plot.id),
    active = (report?.assessments || []).filter((a) => a.status !== 'outside-stage'),
    inactive = (report?.assessments || []).filter((a) => a.status === 'outside-stage'),
    elevated = active.filter((a) => a.level === 'High' || a.level === 'Very high');
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t('DISEASE & PEST WATCH')}</div>
        <h1>{t('Crop health')}</h1>
        <p>
          {t(
            'See which diseases and pests current weather and crop stage favour, and what to scout for.',
          )}
        </p>
      </div>
      <div className="notice">
        <ShieldAlert size={20} />
        <div>
          <strong>{t('A risk index, not a diagnosis')}</strong>
          <p>
            {t(
              'Scores show how favourable recent regional weather and the crop’s growth stage are for each threat. They do not count pests or confirm disease in your field. Always scout, and confirm with your local agriculture officer or KVK before treating.',
            )}
          </p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="card padded">
        <div className="section-heading">
          <h2>
            <Bug size={16} /> {plot.name} · {t(plot.crop || 'Tomato')}
          </h2>
          <label className="field-picker">
            {t('Select plot')}
            <select value={plot.id} onChange={(e) => select(e.target.value)}>
              {farm.plots.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name} · {t(p.crop || 'Tomato')}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading && !report ? (
          <p className="muted">{t('Loading…')}</p>
        ) : !report || report.weatherDays === 0 ? (
          <p className="muted">
            {t(
              'No provider weather has been saved for this run yet. Advance the simulation by a day to start the watch.',
            )}
          </p>
        ) : (
          <p className="muted">
            {t('Based on {{days}} days of weather up to {{date}}', {
              days: report.weatherDays,
              date: dateLabel(report.asOf!),
            })}{' '}
            ·{' '}
            {elevated.length
              ? t('{{count}} threats at High or Very high risk', { count: elevated.length })
              : t('No threats at High risk right now')}
          </p>
        )}
      </section>
      {report && report.weatherDays > 0 && (
        <>
          <div className="threat-grid">
            {active.map((a) => (
              <ThreatCard a={a} key={a.threatId} />
            ))}
          </div>
          {inactive.length > 0 && (
            <section className="card padded table-section">
              <h2>{t('Not at risk at this growth stage')}</h2>
              <p className="muted">
                {t('These threats attack other stages of this crop. Check again as it develops.')}
              </p>
              <ul className="threat-inactive">
                {inactive.map((a) => (
                  <li key={a.threatId}>
                    <strong>{threatById.get(a.threatId)!.name}</strong>
                    <span className="muted">
                      {t('Susceptible stage')}: {a.window}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
