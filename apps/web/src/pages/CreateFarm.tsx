import { SoilWaterGuide } from '../components/SoilWaterGuide';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, ChevronLeft, Plus, Trash2, MapPin } from 'lucide-react';
import { CROPS, farmInput, type FarmInput } from '@agritwin/shared';
import { Button } from '../components/ui/button';
import { FarmMap } from '../components/FarmMap';
import { LanguageSelect } from '../components/Language';
import { post } from '../services/api';
import { useFarm } from '../stores/useFarm';
import { t } from '../i18n';
import { toAcres, toSquareMetres } from '../utils/landArea';
export function CreateFarm() {
  const navigate = useNavigate(),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [farm, setFarm] = useState<FarmInput>({
    name: '',
    location: '',
    latitude: 12.9716,
    longitude: 77.5946,
    area: toSquareMetres(1),
    unit: 'acre',
    boundary: [],
    plots: [
      {
        name: 'Field 01',
        area: toSquareMetres(1),
        crop: 'Soybean',
        soil: 'Loam',
        method: 'Drip',
        plantingDate: today,
      },
    ],
  });
  const [displayArea, setDisplayArea] = useState(1);
  function updatePlot(index: number, key: string, value: unknown) {
    setFarm({
      ...farm,
      plots: farm.plots.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
    });
  }
  function next() {
    setError('');
    if (step === 0 && farm.name.trim().length < 2) {
      setError('Enter a farm name with at least 2 characters.');
      return;
    }
    if (
      step === 1 &&
      (!farm.location.trim() ||
        farm.area < 10 ||
        !Number.isFinite(farm.latitude) ||
        !Number.isFinite(farm.longitude))
    ) {
      setError('Enter a location name, valid coordinates and a positive area.');
      return;
    }
    if (step === 2) {
      const parsed = farmInput.safeParse(farm);
      if (!parsed.success) {
        setError(parsed.error.issues.map((i) => i.message).join('. '));
        return;
      }
    }
    setStep(step + 1);
  }
  async function create() {
    const parsed = farmInput.safeParse(farm);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join('. '));
      return;
    }
    setBusy(true);
    try {
      const created = await post('/farms', parsed.data);
      await useFarm.getState().load();
      await useFarm.getState().open(created.id);
      navigate('/app');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t('Farm workspace')}</div>
        <h1>{t('Create your farm')}</h1>
        <p>
          {t(
            'Understand crop development, water availability and management decisions through a reproducible digital model of your farm.',
          )}
        </p>
      </div>
      <div className="wizard-steps">
        {['Farm details', 'Location & boundary', 'Crops & plots', 'Review & create'].map(
          (name, i) => (
            <div className={i === step ? 'active' : i < step ? 'complete' : ''} key={name}>
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              {t(name)}
            </div>
          ),
        )}
      </div>
      <div className="wizard-layout">
        <section className="card padded">
          <h2>
            {t(['Farm details', 'Location & boundary', 'Crops & plots', 'Review & create'][step])}
          </h2>
          {step === 0 && (
            <>
              <div className="language-field">
                <LanguageSelect />
              </div>
              <label>
                {t('Farm name')}
                <input
                  autoFocus
                  value={farm.name}
                  onChange={(e) => setFarm({ ...farm, name: e.target.value })}
                  maxLength={80}
                  placeholder="e.g. Patil Family Farm"
                />
              </label>
              <div className="notice">
                {t(
                  'Educational simulation. Field validation is required before making real farming decisions.',
                )}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <FarmMap
                latitude={farm.latitude}
                longitude={farm.longitude}
                boundary={farm.boundary || []}
                location={farm.location}
                onLocationName={(location) => setFarm((f) => ({ ...f, location }))}
                onLocation={(point, address) =>
                  setFarm((f) => ({
                    ...f,
                    latitude: point.lat,
                    longitude: point.lng,
                    ...(address ? { location: address } : {}),
                  }))
                }
                onBoundary={(boundary, area) => {
                  setFarm((f) => ({
                    ...f,
                    boundary,
                    ...(area > 0
                      ? {
                          area,
                          plots:
                            f.plots.length === 1
                              ? [{ ...f.plots[0], area: Math.floor(area) }]
                              : f.plots,
                        }
                      : {}),
                  }));
                  if (area > 0) setDisplayArea(Number(toAcres(area).toFixed(4)));
                }}
              />
              <div className="form-grid">
                <label>
                  {t('Latitude')}
                  <input
                    type="number"
                    min={-90}
                    max={90}
                    step="any"
                    value={farm.latitude}
                    onChange={(e) => setFarm({ ...farm, latitude: Number(e.target.value) })}
                  />
                </label>
                <label>
                  {t('Longitude')}
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step="any"
                    value={farm.longitude}
                    onChange={(e) => setFarm({ ...farm, longitude: Number(e.target.value) })}
                  />
                </label>
                <label>
                  {t('Total farm area')} ({t('acres')})
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    value={displayArea}
                    onChange={(e) => {
                      const a = Number(e.target.value);
                      setDisplayArea(a);
                      setFarm({
                        ...farm,
                        area: toSquareMetres(a),
                        plots:
                          farm.plots.length === 1
                            ? [{ ...farm.plots[0], area: toSquareMetres(a) }]
                            : farm.plots,
                      });
                    }}
                  />
                  <small>{t('Land area is shown in acres.')}</small>
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="notice">
                {t('Map location does not determine soil, crops or soil moisture.')}
              </div>
              {farm.plots.map((p, i) => (
                <div className="plot-form" key={i}>
                  <div className="section-heading">
                    <h3>
                      {t('Plot')} {i + 1}
                    </h3>
                    {farm.plots.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={t('Remove plot')}
                        onClick={() =>
                          setFarm({ ...farm, plots: farm.plots.filter((_, j) => i !== j) })
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                  <div className="form-grid">
                    <label>
                      {t('Plot name')}
                      <input
                        value={p.name}
                        onChange={(e) => updatePlot(i, 'name', e.target.value)}
                      />
                    </label>
                    <label>
                      {t('Plot area (acres)')}
                      <input
                        type="number"
                        min={0.0025}
                        step="any"
                        value={Number(toAcres(p.area).toFixed(3))}
                        onChange={(e) =>
                          updatePlot(i, 'area', toSquareMetres(Number(e.target.value)))
                        }
                      />
                    </label>
                    <label>
                      {t('Crop')}
                      <select
                        value={p.crop || 'Tomato'}
                        onChange={(e) => updatePlot(i, 'crop', e.target.value)}
                      >
                        {Object.keys(CROPS).map((c) => (
                          <option key={c} value={c}>
                            {t(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('Soil type')}
                      <select
                        value={p.soil}
                        onChange={(e) => updatePlot(i, 'soil', e.target.value)}
                      >
                        {(['Loam', 'Sandy', 'Clay'] as const).map((c) => (
                          <option key={c} value={c}>
                            {t(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('Irrigation method')}
                      <select
                        value={p.method}
                        onChange={(e) => updatePlot(i, 'method', e.target.value)}
                      >
                        {(['Drip', 'Sprinkler', 'Flood'] as const).map((c) => (
                          <option key={c} value={c}>
                            {t(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('Planting date')}
                      <input
                        type="date"
                        value={p.plantingDate}
                        onChange={(e) => updatePlot(i, 'plantingDate', e.target.value)}
                      />
                    </label>
                  </div>
                  <SoilWaterGuide soil={p.soil} method={p.method} />
                  <small>
                    {CROPS[p.crop || 'Tomato'].variety} · {CROPS[p.crop || 'Tomato'].planning}
                  </small>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setFarm({
                    ...farm,
                    plots: [
                      ...farm.plots,
                      {
                        name: `Field ${farm.plots.length + 1}`,
                        area: Math.max(10, farm.area - farm.plots.reduce((n, p) => n + p.area, 0)),
                        crop: 'Wheat',
                        soil: 'Loam',
                        method: 'Drip',
                        plantingDate: today,
                      },
                    ],
                  })
                }
                disabled={
                  farm.plots.length >= 24 ||
                  farm.plots.reduce((sum, plot) => sum + plot.area, 0) >= farm.area - 10
                }
              >
                <Plus size={16} />
                {t('Add plot')}
              </Button>
              {farm.plots.reduce((sum, plot) => sum + plot.area, 0) >= farm.area - 10 && (
                <small className="muted">{t('Increase the farm area to add another plot.')}</small>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <dl className="review-list">
                <dt>{t('Farm name')}</dt>
                <dd>{farm.name}</dd>
                <dt>{t('Location name')}</dt>
                <dd>{farm.location}</dd>
                <dt>{t('Area')}</dt>
                <dd>{toAcres(farm.area).toFixed(2)} acres</dd>
                <dt>{t('Plots')}</dt>
                <dd>{farm.plots.length}</dd>
              </dl>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {['Plot', 'Crop', 'Area', 'Planting date'].map((x) => (
                        <th key={x}>{t(x)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {farm.plots.map((p, i) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td>{t(p.crop || 'Tomato')}</td>
                        <td>{toAcres(p.area).toFixed(2)} acres</td>
                        <td>{p.plantingDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                {t(
                  'Educational simulation. Field validation is required before making real farming decisions.',
                )}
              </p>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="wizard-actions">
            <Button
              variant="outline"
              disabled={step === 0 || busy}
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={16} />
              {t('Back')}
            </Button>
            {step < 3 ? (
              <Button onClick={next}>
                {t('Next')}
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button disabled={busy} onClick={create}>
                {t(busy ? 'Working…' : 'Create digital farm')}
              </Button>
            )}
          </div>
        </section>
        <aside className="setup-aside">
          <div className="eyebrow">{t('Reference assumptions')}</div>
          <h3>{t('Farm summary')}</h3>
          <p>
            <MapPin size={16} />
            {farm.location || '—'}
          </p>
          <dl>
            <dt>{t('Area')}</dt>
            <dd>{toAcres(farm.area).toFixed(2)} acres</dd>
            <dt>{t('Plots')}</dt>
            <dd>{farm.plots.length}</dd>
            <dt>{t('Crop')}</dt>
            <dd>{[...new Set(farm.plots.map((p) => t(p.crop || 'Tomato')))].join(', ')}</dd>
          </dl>
          <hr />
          <p>{t('Simulated states · no physical sensors')}</p>
        </aside>
      </div>
    </>
  );
}
