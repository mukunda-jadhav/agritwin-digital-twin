import { useState } from 'react';
import { NotebookPen, Download } from 'lucide-react';
import { cropFor, type Farm, type Plot, type Snapshot } from '@agritwin/shared';
import { t } from '../i18n';
import { post } from '../services/api';
import { useFarm } from '../stores/useFarm';
import { fmt, dateLabel } from './common';
import { downloadSeasonReport } from '../utils/seasonReport';

export function FieldNotes({
  farm,
  plot,
  snapshot,
}: {
  farm: Farm;
  plot: Plot;
  snapshot: Snapshot;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const notes = (farm.observations || []).filter(
    (o) => o.runId === farm.run.id && o.plotId === plot.id,
  );
  const comparisons = notes.filter((o) => o.stage);
  const matches = comparisons.filter((o) => o.stage === o.modeledStage).length;
  return (
    <section className="card field-notes">
      <div className="section-heading">
        <div>
          <h2>
            <NotebookPen size={20} />
            {t('My field notebook')}
          </h2>
          <p className="muted">{t('Write what you saw. Compare it with the model.')}</p>
        </div>
        <button className="button button-outline" onClick={() => downloadSeasonReport(farm)}>
          <Download size={18} />
          {t('Download season report')}
        </button>
      </div>
      <details>
        <summary>
          {t('Add a field observation')} · {plot.name}
        </summary>
        <form
          key={plot.id + snapshot.id}
          className="observation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setSaved(false);
            setError('');
            try {
              useFarm
                .getState()
                .setFarm(
                  await post(`/farms/${farm.id}/observations`, {
                    id: crypto.randomUUID(),
                    plotId: plot.id,
                    runId: farm.run.id,
                    date: data.get('date'),
                    stage: data.get('stage') || undefined,
                    heightCm: data.get('height') ? Number(data.get('height')) : undefined,
                    harvestedKg: data.get('harvest') ? Number(data.get('harvest')) : undefined,
                    note: data.get('note'),
                  }),
                );
              setSaved(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="muted">{t('Choose a saved simulation date for a fair comparison.')}</p>
          <div className="form-grid">
            <label>
              {t('Observation date')}
              <select name="date" defaultValue={snapshot.date}>
                {farm.run.history
                  .filter((s, i, all) => all.findIndex((x) => x.date === s.date) === i)
                  .map((s) => (
                    <option key={s.id} value={s.date}>
                      {dateLabel(s.date)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t('Stage seen in the field')}
              <select name="stage">
                <option value="">{t('Not recorded')}</option>
                {cropFor(plot.crop).stages.map((s) => (
                  <option key={s.gdd} value={s.name}>
                    {t(s.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Measured plant height (cm)')}
              <input name="height" type="number" min="0" max="2000" step="0.1" />
            </label>
            <label>
              {t('Total harvest so far (kg)')}
              <input name="harvest" type="number" min="0" max="100000000" step="0.01" />
            </label>
          </div>
          <label>
            {t('What did you notice?')}
            <textarea name="note" maxLength={1000} rows={3} />
          </label>
          <p className="muted">{t('Height is a field record. The 3D plant is illustrative.')}</p>
          <button className="button" disabled={busy}>
            {t(busy ? 'Saving…' : 'Save observation')}
          </button>
        </form>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          {t('Observation saved')}
        </p>
      )}
      {notes.length > 0 && (
        <div className="observation-results">
          <p>
            {t('Stage matches')}:{' '}
            <strong>
              {matches} / {comparisons.length}
            </strong>{' '}
            · {t('Observations')}: {notes.length}
          </p>
          <ul>
            {notes
              .slice(-5)
              .reverse()
              .map((o) => (
                <li key={o.id}>
                  <strong>{dateLabel(o.date)}</strong>
                  <span>
                    {t('Seen')}: {o.stage ? t(o.stage) : '—'} · {t('Model')}: {t(o.modeledStage)}
                  </span>
                  {o.heightCm !== undefined && (
                    <span>
                      {t('Measured plant height (cm)')}: {fmt(o.heightCm, 1)}
                    </span>
                  )}
                  {o.harvestedKg !== undefined && (
                    <span>
                      {t('Harvest difference')}: {fmt(o.harvestedKg - o.modeledHarvestKg, 1)} kg (
                      {t('recorded minus modeled cumulative harvest')})
                    </span>
                  )}
                  {o.note && <p>{o.note}</p>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
