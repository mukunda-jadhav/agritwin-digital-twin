import { TwinEvidence } from '../components/TwinEvidence';
import { seasonState, isMature } from '@agritwin/shared';
import { HarvestNotice } from '../components/HarvestNotice';
import { SoilWaterGuide } from '../components/SoilWaterGuide';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CloudSun,
  Droplets,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ArrowUpRight,
  MapPin,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Layers3,
} from 'lucide-react';
import { cropFor, MODEL_VERSION, type Weather, type Prediction } from '@agritwin/shared';
import { useFarm } from '../stores/useFarm';
import { api, post } from '../services/api';
import { Button } from '../components/ui/button';
import { Speak } from '../components/Language';
import { dateLabel, fmt, HistoryChart, last, plotMoisture, StatCards } from '../components/common';
import type { CameraView } from '../farm3d/FarmScene';
import { t } from '../i18n';
import { toAcres } from '../utils/landArea';
const FarmScene = lazy(() => import('../farm3d/FarmScene'));
export function Twin({ expanded = false }: { expanded?: boolean }) {
  const { farm, selected, select, setFarm } = useFarm(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [weather, setWeather] = useState<Weather[]>([]),
    [predictions, setPredictions] = useState<Prediction[]>([]),
    [view, setView] = useState<CameraView>('isometric'),
    [advanced, setAdvanced] = useState(false),
    [replay, setReplay] = useState(-1),
    [reset, setReset] = useState(false);
  useEffect(() => {
    setReplay(-1);
    setWeather([]);
    setError('');
    setPredictions([]);
    if (farm) {
      let active = true;
      api<Weather[]>(`/farms/${farm.id}/weather`)
        .then((w) => {
          if (active) setWeather(w);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      return () => {
        active = false;
      };
    }
  }, [farm?.id, farm?.run.id]);
  useEffect(() => {
    if (farm) {
      let active = true;
      setPredictions([]);
      api<Prediction[]>(`/farms/${farm.id}/predictions`)
        .then((p) => {
          if (active) setPredictions(p);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      return () => {
        active = false;
      };
    }
  }, [farm?.id, farm?.run.version]);
  if (!farm) return null;
  const season = seasonState(farm.run, farm.plots);
  const snap =
      replay < 0 ? last(farm) : farm.run.history[Math.min(replay, farm.run.history.length - 1)],
    plot = farm.plots.find((p) => p.id === selected) || farm.plots[0],
    state = snap.states.find((s) => s.plotId === plot.id)!,
    crop = cropFor(plot.crop),
    prediction = replay < 0 ? predictions.find((p) => p.plotId === plot.id) : undefined,
    w = snap.weather || weather.find((w) => w.date === snap.date),
    dry = plotMoisture(plot, state.water, farm.run.modelVersion) < 55,
    summary = t(
      dry ? 'Soil moisture is low. Your crop may need water.' : 'Soil water is sufficient.',
    ),
    recommendation = isMature(farm.run, plot, state)
      ? t('Maximum development reached. Record harvest above.')
      : prediction
        ? prediction.amount > 0
          ? t('Model suggests {{litres}} litres ({{mm}} mm) before the next simulated day.', {
              litres: fmt(prediction.amount * plot.area),
              mm: fmt(prediction.amount, 1),
            })
          : t('No irrigation needed today')
        : t('Recommendation unavailable'),
    weatherSummary = w
      ? t('Temperature {{temperature}} degrees. Rainfall {{rain}} millimetres.', {
          temperature: fmt(w.temperature, 1),
          rain: fmt(w.rain, 1),
        })
      : t('Weather unavailable');
  async function control(action: string, days = 1, speed = 1) {
    setBusy(true);
    setError('');
    try {
      setFarm(await post(`/farms/${farm!.id}/control`, { action, days, speed }));
      setReplay(-1);
      setReset(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading twin-heading">
        <div>
          <div className="eyebrow">{t(expanded ? 'Field inspection' : 'Field overview')}</div>
          <h1>{farm.name}</h1>
          <p>
            <MapPin size={15} />
            {farm.location}
            <span className="coordinate">
              {farm.latitude.toFixed(4)}°, {farm.longitude.toFixed(4)}°
            </span>
          </p>
        </div>
        <div className="page-actions">
          <button
            className={`view-switch ${advanced ? 'active' : ''}`}
            onClick={() => setAdvanced(!advanced)}
            aria-pressed={advanced}
          >
            <Settings2 size={16} />
            {t(advanced ? 'Simple view' : 'Advanced view')}
          </button>
          <div className="date-chip">
            <span>{t('Simulation date')}</span>
            <strong>{dateLabel(snap.date)}</strong>
          </div>
        </div>
      </div>
      {replay < 0 && (
        <HarvestNotice
          onRestart={() => {
            setReset(true);
            document
              .getElementById('season-reset')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      )}
      <div className="twin-context-strip">
        <span className="status-dot" />
        <strong>{t('Weather-driven crop model')}</strong>
        <span>{t('Soil water and growth are estimates')}</span>
        <span className="context-day">
          Day {snap.day} · {replay >= 0 ? 'Viewing history' : 'Current simulation state'}
        </span>
      </div>
      {advanced && <StatCards farm={farm} snapshot={snap} />}
      <div className={`twin-grid ${expanded ? 'expanded' : ''}`}>
        <section className="card twin-card">
          <div className="section-heading field-heading">
            <div>
              <h2>
                <Layers3 size={18} />
                {t('Field model')}
              </h2>
              <span className="muted">
                {farm.plots.length} {t('Plots').toLowerCase()} · {fmt(toAcres(farm.area), 2)}{' '}
                {t('acres')} · {t('Simulated')}
              </span>
            </div>
            <label className="field-picker">
              {t('Select plot')}
              <select value={plot.id} onChange={(e) => select(e.target.value)}>
                {farm.plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {t(p.crop || 'Tomato')}
                  </option>
                ))}
              </select>
            </label>
            <span className="badge">
              <span className={`status-dot ${farm.run.status === 'paused' ? 'paused' : ''}`} />
              {t(
                replay >= 0 ? 'Saved state' : farm.run.status === 'running' ? 'Running' : 'Paused',
              )}
            </span>
          </div>
          <div className="camera-toolbar" role="group" aria-label="Camera views">
            {(
              [
                ...(farm.boundary && farm.boundary.length >= 3
                  ? [{ value: 'boundary' as const, label: 'Farm boundary' }]
                  : []),
                { value: 'aerial', label: 'Top view' },
                { value: 'isometric', label: 'Whole farm' },
                { value: 'close', label: 'Crop close-up' },
              ] as const
            ).map((c) => (
              <button
                key={c.value}
                className={view === c.value ? 'active' : ''}
                onClick={() => setView(c.value)}
                aria-pressed={view === c.value}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
          <div className="farm-canvas">
            <Suspense fallback={<div className="scene-fallback">{t('Loading…')}</div>}>
              <FarmScene
                farm={farm}
                snapshot={snap}
                selected={plot.id}
                onSelect={select}
                view={view}
              />
            </Suspense>
          </div>
          <div className="field-caption">
            <span>
              {view === 'boundary'
                ? 'Saved outer boundary · plot locations are not surveyed'
                : t('Schematic layout • sampled plants • not a satellite image')}
            </span>
            <span>Drag to rotate · Scroll to zoom</span>
          </div>
          <div className="simulation-toolbar" id="season-reset">
            <div className="inline">
              <Button
                size="sm"
                disabled={busy || replay >= 0 || season.blocked}
                onClick={() => control(farm.run.status === 'running' ? 'pause' : 'start')}
              >
                {farm.run.status === 'running' ? <Pause size={15} /> : <Play size={15} />}{' '}
                {t(farm.run.status === 'running' ? 'Pause' : 'Start simulation')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || replay >= 0 || season.blocked}
                onClick={() => control('step')}
              >
                <SkipForward size={15} />
                {t('Advance 1 day')}
              </Button>
              {advanced && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || replay >= 0 || season.blocked}
                  onClick={() => control('step', 7)}
                >
                  {t('Advance 7 days')}
                </Button>
              )}
            </div>
            <div className="inline">
              {advanced && (
                <label className="speed-label">
                  {t('Speed')}
                  <select
                    aria-label="Simulation speed"
                    value={farm.run.speed}
                    disabled={busy}
                    onChange={(e) => control('speed', 1, Number(e.target.value))}
                  >
                    <option value={1}>1×</option>
                    <option value={3}>3×</option>
                    <option value={7}>7×</option>
                    <option value={10}>10×</option>
                  </select>
                </label>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('Reset simulation')}
                onClick={() => setReset(!reset)}
              >
                <RotateCcw size={15} />
                {t('New season')}
              </Button>
            </div>
          </div>
          {reset && (
            <div className="notice">
              <div>
                {t('Start again from the planting date? This run will be archived.')}
                <div className="inline">
                  <Button size="sm" disabled={busy} onClick={() => control('reset')}>
                    {t('Reset and archive')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setReset(false)}>
                    {t('Cancel')}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              <span>{t(error)}</span>
            </div>
          )}
          {advanced && (
            <div className="replay">
              <label htmlFor="replay">
                {t('Timeline')}
                <span>
                  {t('Day')} {snap.day} · {t(replay >= 0 ? 'Saved state' : 'Current state')}
                </span>
              </label>
              <input
                id="replay"
                type="range"
                min={0}
                max={Math.max(0, farm.run.history.length - 1)}
                value={replay < 0 ? farm.run.history.length - 1 : replay}
                onChange={(e) => setReplay(Number(e.target.value))}
              />
              {replay >= 0 && (
                <button className="text-button" onClick={() => setReplay(-1)}>
                  {t('Return to current state')} →
                </button>
              )}
            </div>
          )}
        </section>
        <aside className="twin-aside">
          <section className="card condition-card">
            <div className="section-heading">
              <h2>{t('Plot condition')}</h2>
              <span className="plot-code">
                {String(farm.plots.findIndex((p) => p.id === plot.id) + 1).padStart(2, '0')}
              </span>
            </div>
            <h3>{plot.name}</h3>
            <p className="muted">
              {t(plot.crop || 'Tomato')} · {fmt(toAcres(plot.area), 2)} {t('acres')} ·{' '}
              {t(plot.soil)}
            </p>
            <div className={`condition-summary ${dry ? 'attention' : ''}`}>
              {dry ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
              <p>{summary}</p>
            </div>
            <dl className="measurement-list">
              <dt>{t('Growth stage')}</dt>
              <dd>{t(state.stage)}</dd>
              <dt>{t('Estimated available water')}</dt>
              <dd>
                {fmt(plotMoisture(plot, state.water, farm.run.modelVersion))}%{' '}
                <small>of usable capacity</small>
              </dd>
              <dt>{t('Crop condition')}</dt>
              <dd>
                {t(
                  state.stress > 0.6
                    ? 'High stress'
                    : state.stress > 0.25
                      ? 'Moderate stress'
                      : 'Low stress',
                )}
              </dd>
            </dl>
            <div className="recommendation">
              <span className="eyebrow">{t('Next action')}</span>
              <p>{recommendation}</p>
              <Link to="/app/irrigation">
                {t('Manage irrigation')}
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <details className="soil-help">
              <summary>{t('Understand soil and watering')}</summary>
              <SoilWaterGuide soil={plot.soil} method={plot.method} />
              <p>
                {t(
                  'Available soil water is the usable water between the wilting point (0%) and field capacity (100%). It is not the percentage of soil made of water.',
                )}
              </p>
            </details>
            <Speak
              text={`${plot.name}. ${summary} ${recommendation} ${weatherSummary} ${t(state.stage)}.`}
            />
          </section>
          <section className="card weather-card">
            <div className="section-heading">
              <h2>{t('Weather conditions')}</h2>
              <CloudSun size={23} />
            </div>
            <div className="weather-temp">
              {w ? fmt(w.temperature, 1) : '—'}
              <span>°C</span>
            </div>
            <p className="weather-source">
              {t(
                !w
                  ? 'Weather unavailable'
                  : w.source === 'carried-forward'
                    ? 'Carried forward from {{date}}'
                    : w.source === 'historical'
                      ? 'Historical / reanalysis'
                      : 'Forecast',
                w?.source === 'carried-forward'
                  ? { date: dateLabel(w.sourceDate || w.date) }
                  : undefined,
              )}
              {w && ` · ${dateLabel(w.date)}`}
            </p>
            <div className="weather-details">
              <div>
                <span>{t('Rainfall')}</span>
                <strong>{w ? fmt(w.rain, 1) : '—'} mm</strong>
              </div>
              <div>
                <span>{t('Humidity')}</span>
                <strong>{w ? fmt(w.humidity) : '—'}%</strong>
              </div>
              {advanced && (
                <>
                  <div>
                    <span>{t('Reference ET')}</span>
                    <strong>{w ? fmt(w.et0, 1) : '—'} mm</strong>
                  </div>
                  <div>
                    <span>{t('Solar energy')}</span>
                    <strong>{w ? fmt(w.solar, 1) : '—'} MJ/m²</strong>
                  </div>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
      {advanced && (
        <div className="lower-grid">
          <section className="card padded">
            <div className="section-heading">
              <h2>{t('Plot conditions')}</h2>
              <span className="tiny-badge">{t('Simulated')}</span>
            </div>
            <div className="plot-grid">
              {farm.plots.map((p, i) => {
                const s = snap.states.find((s) => s.plotId === p.id)!;
                return (
                  <button
                    key={p.id}
                    onClick={() => select(p.id)}
                    className={`plot-card ${selected === p.id ? 'selected' : ''}`}
                    aria-pressed={selected === p.id}
                  >
                    <div className="plot-number">
                      FIELD {String(i + 1).padStart(2, '0')}
                      <ArrowUpRight size={15} />
                    </div>
                    <strong>{p.name}</strong>
                    <small>
                      {t(p.crop || 'Tomato')} · {t(p.soil)}
                    </small>
                    <div className="plot-status">
                      <Droplets size={14} />
                      {fmt(plotMoisture(p, s.water, farm.run.modelVersion))}%
                    </div>
                    <div className="progress">
                      <span
                        style={{ width: `${plotMoisture(p, s.water, farm.run.modelVersion)}%` }}
                      />
                    </div>
                    <small>{t(s.stage)}</small>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="card padded">
            <div className="section-heading">
              <h2>{t('Soil water history')}</h2>
              <Link className="text-button" to="/app/analytics">
                {t('View analytics')}
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <HistoryChart farm={farm} plotId={plot.id} />
          </section>
        </div>
      )}
      <TwinEvidence farm={farm} snapshot={snap} weather={w} />
      {advanced && (
        <section className="card padded table-section">
          <div className="section-heading">
            <h2>
              {t('Technical measurements')} / {plot.name}
            </h2>
            <span className="tiny-badge">{farm.run.modelVersion}</span>
          </div>
          <div className="advanced-grid">
            <dl className="measurement-list">
              <dt>{t('Root-zone water')}</dt>
              <dd>{fmt(state.water, 2)} mm</dd>
              <dt>{t('Growing degree days')}</dt>
              <dd>{fmt(state.gdd, 1)} °C·d</dd>
              <dt>{t('Simulated yield')}</dt>
              <dd>{fmt(state.yieldKg, 1)} kg</dd>
              <dt>{t('Harvest recorded')}</dt>
              <dd>{fmt(state.harvestedKg || 0, 1)} kg</dd>
            </dl>
            <div>
              <h3>{t('Reference assumptions')}</h3>
              <p className="muted">
                {crop.variety}
                <br />
                {crop.rowSpacing} m row spacing · {crop.plantSpacing} m plant spacing
                <br />
                ETc = ET₀ × Kc × Ks · {crop.baseTemperature}°C base temperature
                <br />
                Root zone:{' '}
                {(farm.run.modelVersion === MODEL_VERSION ? crop.rootDepthM : 0.3).toFixed(2)} m ·{' '}
                {crop.planning}
              </p>
            </div>
            {replay < 0 &&
              state.gdd >=
                (farm.run.modelVersion === 'tomato-educational-v1' ? 1500 : crop.harvestGdd) &&
              state.yieldKg - (state.harvestedKg || 0) > 0 && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      setFarm(
                        await post(`/farms/${farm.id}/harvest`, {
                          id: crypto.randomUUID(),
                          plotId: plot.id,
                          kg: Number(new FormData(e.currentTarget).get('kg')),
                        }),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    {t('Harvest amount (kg)')}
                    <input
                      type="number"
                      name="kg"
                      min={0.01}
                      step={0.01}
                      max={state.yieldKg - (state.harvestedKg || 0)}
                      defaultValue={1}
                      required
                    />
                  </label>
                  <Button disabled={busy}>{t('Record harvest')}</Button>
                </form>
              )}
          </div>
          <p className="model-note">
            {t(
              'Educational simulation. Field validation is required before making real farming decisions.',
            )}
          </p>
        </section>
      )}
    </>
  );
}
