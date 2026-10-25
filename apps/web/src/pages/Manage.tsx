import { SoilWaterGuide, methodEfficiency } from '../components/SoilWaterGuide';
import { isMature } from '@agritwin/shared';
import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { Droplets, Leaf, FlaskConical, ArrowRight } from 'lucide-react';
import type { Prediction, Scenario } from '@agritwin/shared';
import { useFarm } from '../stores/useFarm';
import { api, post } from '../services/api';
import { Button } from '../components/ui/button';
import {
  ComparisonChart,
  dateLabel,
  fmt,
  HistoryChart,
  last,
  metrics,
  StatCards,
} from '../components/common';
export function Irrigation() {
  const { farm, selected, setFarm, select } = useFarm(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState('now'),
    [waterUnit, setWaterUnit] = useState<'litres' | 'mm' | 'duration'>('litres'),
    [minutes, setMinutes] = useState(30),
    [flow, setFlow] = useState(0),
    [amount, setAmount] = useState(15),
    [message, setMessage] = useState('');
  if (!farm) return null;
  const activePlot = farm.plots.find((p) => p.id === selected) || farm.plots[0],
    activeState = last(farm).states.find((s) => s.plotId === activePlot.id)!,
    finished = isMature(farm.run, activePlot, activeState),
    appliedAmount = waterUnit === 'duration' ? (minutes * flow) / activePlot.area : amount,
    litres = appliedAmount * activePlot.area,
    delivered = litres * methodEfficiency[activePlot.method];
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t('WATER MANAGEMENT')}</div>
        <h1>{t('Irrigation management')}</h1>
        <p>
          {t(
            'Record past watering for the current virtual date, or schedule a hypothetical future application. The app never controls a real pump.',
          )}
        </p>
      </div>
      <p className="notice">
        Record water for simulation date {dateLabel(last(farm).date)}. Only enter completed watering
        for that date. Schedules are hypothetical future applications; no pump is controlled.
      </p>
      <div className="manage-grid">
        <form
          className="card padded"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setMessage('');
            const d = Object.fromEntries(new FormData(e.currentTarget));
            try {
              setFarm(
                await post(`/farms/${farm.id}/irrigation`, {
                  id: crypto.randomUUID(),
                  plotId: d.plotId,
                  amount: appliedAmount,
                  interval: mode === 'schedule' ? Number(d.interval) : 0,
                  ...(mode === 'schedule' ? { date: d.date } : {}),
                }),
              );
              setMessage(
                mode === 'schedule'
                  ? 'Schedule saved. It will run on the virtual clock.'
                  : 'Irrigation applied. Soil water and usage have been updated.',
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>
            <Droplets size={20} />
            {t('Record watering')}
          </h2>
          <label>
            {t('Plot')}
            <select name="plotId" value={activePlot.id} onChange={(e) => select(e.target.value)}>
              {farm.plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.method}
                </option>
              ))}
            </select>
          </label>
          <SoilWaterGuide soil={activePlot.soil} method={activePlot.method} />
          <label>
            {t('Water unit')}
            <select
              value={waterUnit}
              onChange={(e) => setWaterUnit(e.target.value as 'litres' | 'mm' | 'duration')}
            >
              <option value="litres">{t('Total litres')}</option>
              <option value="mm">{t('Depth in millimetres')}</option>
              <option value="duration">{t('Duration and flow rate')}</option>
            </select>
          </label>
          {waterUnit === 'duration' ? (
            <div className="form-grid">
              <label>
                {t('Duration (minutes)')}
                <input
                  type="number"
                  min="1"
                  max="1440"
                  step="any"
                  required
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
              <label>
                {t('Measured flow (litres/minute)')}
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={flow || ''}
                  onChange={(e) => setFlow(Number(e.target.value))}
                />
              </label>
              <small>
                {t(
                  'Use your measured flow rate. The app cannot infer it from the irrigation method.',
                )}
              </small>
            </div>
          ) : (
            <label>
              {t(waterUnit === 'litres' ? 'Total water (litres)' : 'Water depth (mm)')}
              <input
                name="amount"
                type="number"
                min={waterUnit === 'litres' ? activePlot.area * 0.1 : 0.1}
                max={waterUnit === 'litres' ? activePlot.area * 100 : 100}
                step="any"
                value={
                  waterUnit === 'litres' ? Number((amount * activePlot.area).toFixed(2)) : amount
                }
                onChange={(e) =>
                  setAmount(Number(e.target.value) / (waterUnit === 'litres' ? activePlot.area : 1))
                }
                required
              />
            </label>
          )}
          <div className="water-preview">
            <h3>{t('This application')}</h3>
            <dl>
              <dt>{t('Water taken from supply')}</dt>
              <dd>{fmt(litres)} L</dd>
              <dt>{t('Reaches soil before runoff')}</dt>
              <dd>{fmt(delivered)} L</dd>
              <dt>{t('Application loss')}</dt>
              <dd>{fmt(litres - delivered)} L</dd>
            </dl>
            <small>{t('Excess water can still run off or drain below the roots.')}</small>
          </div>
          <small>
            {t(
              '1 mm over 1 m² uses 1 litre. Method efficiency affects water that reaches the soil.',
            )}
          </small>
          <label>
            {t('When to irrigate')}
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="now">{t('Apply now')}</option>
              <option value="schedule">{t('Schedule irrigation')}</option>
            </select>
          </label>
          {mode === 'schedule' && (
            <div className="form-grid">
              <label>
                {t('First virtual date')}
                <input
                  name="date"
                  type="date"
                  min={new Date(Date.parse(last(farm).date) + 86400000).toISOString().slice(0, 10)}
                  required
                />
              </label>
              <label>
                {t('Repeat every (days)')}
                <input name="interval" type="number" min={0} max={30} defaultValue={2} required />
                <small>{t('0 means once only')}</small>
              </label>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="success" role="status">
              {t(message)}
            </p>
          )}
          {finished && (
            <p className="notice">
              {t(
                'This crop has finished growing. Irrigation is disabled; record the harvest in Overview.',
              )}
            </p>
          )}
          <Button disabled={busy || finished}>
            <Droplets size={16} />
            {t(busy ? 'Saving…' : mode === 'now' ? 'Save watering record' : 'Save schedule')}
          </Button>
        </form>
        <section className="card padded">
          <h2>Irrigation history & schedules</h2>
          {!farm.run.events.length ? (
            <div className="empty">
              <Droplets size={35} />
              <p>{t('Your first irrigation will appear here.')}</p>
            </div>
          ) : (
            <div className="event-list">
              {[...farm.run.events].reverse().map((e) => (
                <article className="event" key={e.id}>
                  <span className="event-icon">
                    <Droplets size={17} />
                  </span>
                  <div>
                    <strong>
                      {farm.plots.find((p) => p.id === e.plotId)?.name} · {e.amount}
                      {t('mm')}
                    </strong>
                    <small>
                      {dateLabel(e.date)} ·{' '}
                      {e.kind === 'manual'
                        ? 'Manual'
                        : e.interval
                          ? `Every ${e.interval} days`
                          : 'One-time schedule'}
                    </small>
                    <small>
                      {e.appliedDates.length}
                      {t('application(s) ·')}{' '}
                      {fmt(
                        e.amount *
                          (farm.plots.find((p) => p.id === e.plotId)?.area || 0) *
                          e.appliedDates.length,
                      )}{' '}
                      {t('L used')}
                    </small>
                  </div>
                  {e.kind === 'schedule' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          setFarm(
                            await api(`/farms/${farm.id}/irrigation/${e.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ enabled: !e.enabled }),
                            }),
                          );
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      {t(e.enabled ? 'Disable' : 'Enable')}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
export function Insights() {
  const { farm } = useFarm(),
    [predictions, setPredictions] = useState<Prediction[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    if (farm)
      api<Prediction[]>(`/farms/${farm.id}/predictions`)
        .then(setPredictions)
        .catch((e) => setError(e.message));
  }, [farm?.id, farm?.run.version]);
  if (!farm) return null;
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t('MODEL-BASED GUIDANCE')}</div>
        <h1>{t('Crop decision support')}</h1>
        <p>{t('Understand the signals behind your farm’s simulated performance.')}</p>
      </div>
      <div className="notice">
        <Leaf size={20} />
        <div>
          <strong>{t('Transparent simulation baselines')}</strong>
          <p>
            {t(
              'Recommendations use provider weather, a modeled root-zone water balance and crop reference parameters. Growth, stress and yield remain estimates without field validation.',
            )}
          </p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="insights-grid">
        {predictions.map((p) => (
          <article className="card padded" key={p.plotId}>
            <div className="section-heading">
              <h2>{farm.plots.find((x) => x.id === p.plotId)?.name}</h2>
              <span className="badge">
                {p.stress}
                {t('stress')}
              </span>
            </div>
            <div className="insight-amount">
              {fmt(p.amount, 1)}
              <span>{t('mm recommended')}</span>
            </div>
            <p>{t(p.timing)}</p>
            <hr />
            <p>
              <strong>
                {fmt(p.yieldKg)}
                {t('kg')}
              </strong>
              {t('estimated accumulated yield')}
            </p>
            <ul>
              {p.factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
export function Analytics() {
  const { farm, selected, select } = useFarm();
  if (!farm) return null;
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t('SIMULATION RECORDS')}</div>
        <h1>{t('Farm analytics')}</h1>
        <p>{t('Review saved measurements and the daily root-zone water balance.')}</p>
      </div>
      <StatCards farm={farm} />
      <section className="card padded">
        <div className="section-heading">
          <h2>Water & growth over time</h2>
          <label className="field-picker">
            {t('Select plot')}
            <select value={selected} onChange={(event) => select(event.target.value)}>
              {farm.plots.map((plot) => (
                <option value={plot.id} key={plot.id}>
                  {plot.name} · {t(plot.crop || 'Tomato')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <HistoryChart farm={farm} plotId={selected} />
      </section>
      <section className="card padded table-section">
        <h2>{t('Daily water balance')}</h2>
        <p className="muted">
          {t(
            'All values are mm of water. Each row includes application losses and runoff so the balance can be checked.',
          )}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  'Date',
                  'Plot',
                  'Initial',
                  'Rain',
                  'Irrigation',
                  'Loss',
                  'Runoff',
                  'ET',
                  'Drainage',
                  'Final',
                ].map((x) => (
                  <th key={x}>{t(x)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...farm.run.history]
                .reverse()
                .slice(0, 60)
                .flatMap((s) =>
                  s.states.map((p) => (
                    <tr key={s.id + p.plotId}>
                      <td>{s.date}</td>
                      <td>{farm.plots.find((x) => x.id === p.plotId)?.name}</td>
                      {(
                        [
                          'initial',
                          'rain',
                          'irrigation',
                          'loss',
                          'runoff',
                          'et',
                          'drainage',
                          'final',
                        ] as const
                      ).map((k) => (
                        <td key={k}>{fmt(p.balance[k], 2)}</td>
                      ))}
                    </tr>
                  )),
                )}
            </tbody>
          </table>
        </div>
        <small>
          {t(
            'Showing the most recent 60 snapshots. Complete history is available through the analytics API.',
          )}
        </small>
      </section>
      {farm.archives.length > 0 && (
        <section className="card padded table-section">
          <h2>{t('Archived runs')}</h2>
          {farm.archives.map((r) => (
            <p key={r.id}>
              {r.history[0].date} → {r.history.at(-1)!.date} · {r.history.length}
              {t('snapshots ·')} {r.modelVersion}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
export function Scenarios() {
  const { farm, open } = useFarm(),
    [scenario, setScenario] = useState<Scenario | null>(null),
    [field, setField] = useState<'moisture' | 'stress' | 'growth' | 'water' | 'yield'>('moisture'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setScenario(null);
  }, [farm?.id]);
  if (!farm) return null;
  const a = scenario ? metrics(farm, scenario.baseline.at(-1)!) : null,
    b = scenario ? metrics(farm, scenario.experiment.at(-1)!) : null;
  const data =
    scenario?.baseline.map((s, i) => {
      const x = metrics(farm, s),
        y = metrics(farm, scenario.experiment[i]);
      return {
        day: i,
        ...Object.fromEntries(Object.entries(x).map(([k, v]) => ['a' + k, v])),
        ...Object.fromEntries(Object.entries(y).map(([k, v]) => ['b' + k, v])),
      };
    }) || [];
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t('SCENARIO COMPARISON')}</div>
        <h1>{t('Scenario analysis')}</h1>
        <p>{t('Compare management decisions using identical initial field conditions.')}</p>
      </div>
      <div className="scenario-layout">
        <form
          className="card padded"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const d = Object.fromEntries(new FormData(e.currentTarget));
            try {
              setScenario(
                await post(`/farms/${farm.id}/scenarios`, {
                  name: d.name,
                  days: Number(d.days),
                  rainMultiplier: Number(d.rain) / 100,
                  temperatureDelta: Number(d.temperature),
                  irrigationMultiplier: Number(d.water) / 100,
                  interval: Number(d.interval),
                  amount: Number(d.amount),
                }),
              );
              await open(farm.id);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>
            <FlaskConical size={20} />
            {t('Design an experiment')}
          </h2>
          <label>
            {t('Experiment name')}
            <input name="name" defaultValue="25% less irrigation" required maxLength={70} />
          </label>
          <div className="form-grid">
            <label>
              {t('Duration (days)')}
              <input name="days" type="number" defaultValue={30} min={1} max={120} required />
            </label>
            <label>
              {t('Temperature change (°C)')}
              <input
                name="temperature"
                type="number"
                defaultValue={0}
                min={-10}
                max={10}
                step={0.5}
                required
              />
            </label>
            <label>
              {t('Rainfall (% of baseline)')}
              <input name="rain" type="number" defaultValue={100} min={0} max={300} required />
            </label>
            <label>
              {t('Irrigation (% of baseline)')}
              <input name="water" type="number" defaultValue={75} min={0} max={200} required />
            </label>
          </div>
          <h3>{t('Baseline irrigation policy')}</h3>
          <div className="form-grid">
            <label>
              {t('Water per application (mm)')}
              <input name="amount" type="number" defaultValue={15} min={0} max={80} required />
            </label>
            <label>
              {t('Every (days)')}
              <input name="interval" type="number" defaultValue={2} min={1} max={30} required />
            </label>
          </div>
          <small>
            {t(
              'Both branches start with the current snapshot. This policy replaces existing schedules in both branches. The experiment scales its water amount; rainfall and temperature change only in that branch.',
            )}
          </small>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy}>
            {t(busy ? 'Simulating both futures…' : 'Run experiment')}
            <ArrowRight size={16} />
          </Button>
        </form>
        <section className="card padded">
          {scenario && a && b ? (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{t('EXPERIMENT RESULTS')}</span>
                  <h2>{scenario.config.name}</h2>
                </div>
                <span className="badge">
                  {scenario.config.days}
                  {t('days')}
                </span>
              </div>
              <label>
                {t('Compare metric')}
                <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>
                  <option value="moisture">{t('Available water (%)')}</option>
                  <option value="stress">{t('Water stress (%)')}</option>
                  <option value="growth">{t('Growth (%)')}</option>
                  <option value="water">{t('Cumulative water use (litres)')}</option>
                  <option value="yield">{t('Estimated yield (kg)')}</option>
                </select>
              </label>
              <ComparisonChart data={data} field={field} />
              <table>
                <thead>
                  <tr>
                    <th>{t('Final state')}</th>
                    <th>{t('Baseline')}</th>
                    <th>{t('Experiment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { key: 'moisture', label: 'Available water', unit: '%' },
                      { key: 'stress', label: 'Stress', unit: '%' },
                      { key: 'growth', label: 'Growth', unit: '%' },
                      { key: 'water', label: 'Water applied', unit: 'L' },
                      { key: 'yield', label: 'Estimated yield', unit: 'kg' },
                    ] as const
                  ).map((r) => (
                    <tr key={r.key}>
                      <td>{t(r.label)}</td>
                      <td>
                        {fmt(a[r.key], 1)} {r.unit}
                      </td>
                      <td>
                        {fmt(b[r.key], 1)} {r.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">
                {t('Weather inputs:')}{' '}
                {[...new Set(scenario.baseline.slice(1).map((s) => s.weather?.source))].join(', ')}
                {t(
                  '. Scenario weather follows the stored provider record and does not change the active farm.',
                )}
              </p>
            </>
          ) : (
            <div className="empty experiment-empty">
              <FlaskConical size={44} />
              <h2>{t('Configure a comparison')}</h2>
              <p>
                {t(
                  'Try less rainfall, a warmer season, or a different irrigation policy. Your live farm stays unchanged.',
                )}
              </p>
            </div>
          )}
          {farm.scenarios.length > 0 && (
            <>
              <hr />
              <label>
                {t('Saved experiments')}
                <select
                  value={scenario?.id || ''}
                  onChange={(e) =>
                    setScenario(farm.scenarios.find((s) => s.id === e.target.value) || null)
                  }
                >
                  <option value="">{t('Choose an experiment')}</option>
                  {farm.scenarios.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.config.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </section>
      </div>
    </>
  );
}
