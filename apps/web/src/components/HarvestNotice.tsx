import { useState } from 'react';
import { cropFor, seasonState, remainingYield } from '@agritwin/shared';
import { useFarm } from '../stores/useFarm';
import { post } from '../services/api';
import { Button } from './ui/button';
import { fmt, last } from './common';
import { t } from '../i18n';

export function HarvestNotice({ onRestart }: { onRestart: () => void }) {
  const { farm, setFarm } = useFarm(),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  if (!farm) return null;
  const season = seasonState(farm.run, farm.plots),
    snap = last(farm);
  const harvestable = farm.plots.filter((p) => {
    const s = snap.states.find((s) => s.plotId === p.id)!;
    return (
      season.awaitingHarvest.some((x) => x.id === p.id) ||
      (s.gdd >=
        (farm.run.modelVersion === 'tomato-educational-v1' ? 1500 : cropFor(p.crop).harvestGdd) &&
        remainingYield(s) > 0.000001)
    );
  });
  if (!season.complete && !harvestable.length) return null;
  return (
    <section className="harvest-notice" role="status" aria-live="polite">
      <div>
        <h2>
          {t(
            season.blocked
              ? 'Simulation stopped — crop maturity reached'
              : 'Harvest window is open',
          )}
        </h2>
        <p>
          {t(
            season.complete
              ? 'All plots have reached maximum development. Record the remaining harvest, then restart to begin another simulated season.'
              : season.blocked
                ? 'Record the mature crop harvest before continuing the other plots. Mature plots will no longer grow or receive scheduled irrigation.'
                : 'You can record the available crop now. Growth continues until maximum development, when the simulation stops automatically.',
          )}
        </p>
      </div>
      {harvestable.map((p) => {
        const s = snap.states.find((s) => s.plotId === p.id)!,
          kg = remainingYield(s);
        return (
          <div className="harvest-row" key={p.id}>
            <div>
              <strong>
                {p.name} · {t(p.crop || 'Tomato')}
              </strong>
              <span>
                {fmt(kg, 2)} kg {t('available to harvest')}
              </span>
            </div>
            <Button
              disabled={!!busy}
              onClick={async () => {
                setBusy(p.id);
                setError('');
                try {
                  setFarm(
                    await post(`/farms/${farm.id}/harvest`, {
                      id: crypto.randomUUID(),
                      plotId: p.id,
                      kg,
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy('');
                }
              }}
            >
              {t(
                busy === p.id
                  ? 'Working…'
                  : kg <= 0.000001
                    ? 'Acknowledge no harvest'
                    : 'Record available harvest',
              )}
            </Button>
          </div>
        );
      })}
      {season.complete && (
        <Button variant="outline" onClick={onRestart}>
          {t('Restart season')}
        </Button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <small>{t('Harvest records are simulated quantities, not measured farm production.')}</small>
    </section>
  );
}
