import { lazy, Suspense, useState } from 'react';
import type { Farm, Scenario } from '@agritwin/shared';
import type { CameraView, FieldLayer, CameraLink } from '../farm3d/FarmScene';
import { SeasonTimeline } from './SeasonTimeline';
import { fmt, metrics } from './common';
import { t } from '../i18n';
const FarmScene = lazy(() => import('../farm3d/FarmScene'));

export function ScenarioFields({ farm, scenario }: { farm: Farm; scenario: Scenario }) {
  const [index, setIndex] = useState(0);
  const [cameraLink] = useState<CameraLink>(() => new Set());
  const [view, setView] = useState<CameraView>('isometric');
  const [layer, setLayer] = useState<FieldLayer>('natural');
  const [selected, setSelected] = useState(farm.plots[0].id);
  const a = scenario.baseline[index],
    b = scenario.experiment[index];
  if (!a || !b) return null;
  const am = metrics(farm, a),
    bm = metrics(farm, b);
  return (
    <section className="scenario-fields">
      <h3>{t('Watch both choices')}</h3>
      <p className="muted">{t('Same starting field. Two different choices.')}</p>
      <div className="layer-toolbar">
        <label>
          {t('Select plot')}
          <select
            aria-label={t('Select plot')}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {farm.plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Camera')}
          <select
            aria-label={t('Camera')}
            value={view}
            onChange={(e) => setView(e.target.value as CameraView)}
          >
            <option value="isometric">{t('Whole farm')}</option>
            <option value="aerial">{t('Top view')}</option>
            <option value="close">{t('Crop close-up')}</option>
          </select>
        </label>
        <label>
          {t('Show on field')}
          <select
            aria-label={t('Show on field')}
            value={layer}
            onChange={(e) => setLayer(e.target.value as FieldLayer)}
          >
            <option value="natural">{t('Crops')}</option>
            <option value="water">{t('Soil water')}</option>
            <option value="stress">{t('Crop stress')}</option>
          </select>
        </label>
      </div>
      <div className="comparison-fields">
        {[
          { name: 'Usual watering', snapshot: a },
          { name: 'Your experiment', snapshot: b },
        ].map((branch) => (
          <div key={branch.name}>
            <strong className="comparison-title">{t(branch.name)}</strong>
            <div className="comparison-canvas">
              <Suspense fallback={<p>{t('Loading…')}</p>}>
                <FarmScene
                  farm={farm}
                  snapshot={branch.snapshot}
                  selected={selected}
                  onSelect={setSelected}
                  view={view}
                  layer={layer}
                  cameraLink={cameraLink}
                />
              </Suspense>
            </div>
          </div>
        ))}
      </div>
      <div className="comparison-deltas">
        <span>
          {t('Water applied')}: <strong>{fmt(bm.water - am.water)} L</strong>
        </span>
        <span>
          {t('Stress')}:{' '}
          <strong>
            {fmt(bm.stress - am.stress, 1)} {t('percentage points')}
          </strong>
        </span>
        <span>
          {t('Estimated yield')}: <strong>{fmt(bm.yield - am.yield, 1)} kg</strong>
        </span>
      </div>
      <p className="muted">
        {t('Difference from usual watering at the selected day. Estimates only.')}
      </p>
      <SeasonTimeline
        history={scenario.baseline}
        plotId={selected}
        index={index}
        onChange={setIndex}
      />
    </section>
  );
}
