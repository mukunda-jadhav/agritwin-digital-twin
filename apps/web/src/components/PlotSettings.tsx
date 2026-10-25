import { soilHelp, waterHelp } from './SoilWaterGuide';
import { t } from '../i18n';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFarm } from '../stores/useFarm';
import { api } from '../services/api';
import { Button } from './ui/button';
import { CROP_NAMES } from '@agritwin/shared';
import { toAcres, toSquareMetres } from '../utils/landArea';
export function PlotSettings() {
  const { farm, setFarm } = useFarm(),
    [editing, setEditing] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!farm) return null;
  const locked = farm.run.version > 0 || farm.archives.length > 0,
    p = farm.plots.find((p) => p.id === editing);
  return (
    <section className="card padded table-section settings-form">
      <div className="section-heading">
        <h2>{t('Growing plots')}</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={
            locked || farm.plots.reduce((sum, plot) => sum + plot.area, 0) >= farm.area - 10
          }
          onClick={() => setEditing('new')}
        >
          <Plus size={16} />
          {t('Add plot')}
        </Button>
      </div>
      {!locked && farm.plots.reduce((sum, plot) => sum + plot.area, 0) >= farm.area - 10 && (
        <small className="muted">{t('Increase the farm area to add another plot.')}</small>
      )}
      <p className="muted">
        {locked
          ? 'Plot configuration is locked after a simulation starts so saved history stays reproducible. Create a new farm for another layout.'
          : 'Configure your plots before starting the simulation. Plot area is shown in acres.'}
      </p>
      {farm.plots.map((plot) => (
        <div className="event" key={plot.id}>
          <div>
            <strong>{plot.name}</strong>
            <small>
              {toAcres(plot.area).toFixed(2)} {t('acres ·')}
              {t(plot.crop || 'Tomato')} · {t(plot.soil)} · {plot.method} · {plot.plantingDate}
            </small>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={locked || busy}
            onClick={() => setEditing(plot.id)}
          >
            {t('Edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${plot.name}`}
            disabled={locked || busy || farm.plots.length === 1}
            onClick={async () => {
              if (!window.confirm(t('Confirm deletion') + ': ' + plot.name + '?')) return;
              setBusy(true);
              try {
                setFarm(await api(`/farms/${farm.id}/plots/${plot.id}`, { method: 'DELETE' }));
                setEditing('');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      {editing && !locked && (
        <form
          key={editing}
          className="plot-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const d = Object.fromEntries(new FormData(e.currentTarget));
            try {
              setFarm(
                await api(`/farms/${farm.id}/plots${editing === 'new' ? '' : '/' + editing}`, {
                  method: editing === 'new' ? 'POST' : 'PATCH',
                  body: JSON.stringify({ ...d, area: toSquareMetres(Number(d.area)) }),
                }),
              );
              setEditing('');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>{p ? 'Edit plot' : 'New growing plot'}</h3>
          <div className="form-grid">
            <label>
              {t('Plot name')}
              <input
                name="name"
                defaultValue={p?.name || ''}
                minLength={1}
                maxLength={60}
                required
              />
            </label>
            <label>
              {t('Area (acres)')}
              <input
                name="area"
                type="number"
                defaultValue={
                  p
                    ? toAcres(p.area)
                    : toAcres(
                        Math.max(
                          10,
                          farm.area - farm.plots.reduce((sum, plot) => sum + plot.area, 0),
                        ),
                      )
                }
                min={0.0025}
                max={toAcres(
                  farm.area -
                    farm.plots.reduce((sum, plot) => sum + (plot.id === p?.id ? 0 : plot.area), 0),
                )}
                step="any"
                required
              />
            </label>
            <label>
              {t('Crop')}
              <select name="crop" defaultValue={p?.crop || 'Soybean'}>
                {CROP_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Soil')}
              <select name="soil" defaultValue={p?.soil || 'Loam'}>
                <option value="Loam">{t('Loam')}</option>
                <option value="Sandy">{t('Sandy')}</option>
                <option value="Clay">{t('Clay')}</option>
              </select>
            </label>
            <label>
              {t('Irrigation method')}
              <select name="method" defaultValue={p?.method || 'Drip'}>
                <option value="Drip">{t('Drip')}</option>
                <option value="Sprinkler">{t('Sprinkler')}</option>
                <option value="Flood">{t('Flood')}</option>
              </select>
            </label>
            <label>
              {t('Planting date')}
              <input
                name="plantingDate"
                type="date"
                defaultValue={p?.plantingDate || farm.run.history[0].date}
                required
              />
            </label>
          </div>
          <details className="soil-help">
            <summary>{t('What do these choices mean?')}</summary>
            <div className="soil-water-guide">
              <h3>{t('Soil type')}</h3>
              {Object.entries(soilHelp).map(([name, description]) => (
                <p key={name}>
                  <strong>{t(name)}</strong> — {t(description)}
                </p>
              ))}
              <h3>{t('Watering system')}</h3>
              {Object.entries(waterHelp).map(([name, description]) => (
                <p key={name}>
                  <strong>{t(name)}</strong> — {t(description)}
                </p>
              ))}
            </div>
          </details>
          <div className="inline">
            <Button disabled={busy}>{t('Save plot')}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing('')}>
              {t('Cancel')}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
