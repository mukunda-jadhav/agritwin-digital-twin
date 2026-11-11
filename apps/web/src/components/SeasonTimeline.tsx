import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Droplets, CloudRain } from 'lucide-react';
import type { Snapshot } from '@agritwin/shared';
import { t } from '../i18n';
import { dateLabel } from './common';

export function SeasonTimeline({
  history,
  plotId,
  index,
  onChange,
  onCurrent,
}: {
  history: Snapshot[];
  plotId: string;
  index: number;
  onChange: (index: number) => void;
  onCurrent?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const end = Math.max(0, history.length - 1);
  const cursor = index < 0 ? end : Math.min(index, end);
  useEffect(() => {
    if (!playing) return;
    if (cursor >= end) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => onChange(cursor + 1), 1100 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, end, speed, onChange]);
  const snapshot = history[cursor];
  if (!snapshot) return null;
  const milestones = history.flatMap((s, i) => {
    const stage = s.states.find((p) => p.plotId === plotId)?.stage;
    return stage &&
      (i === 0 || stage !== history[i - 1].states.find((p) => p.plotId === plotId)?.stage)
      ? [{ i, stage }]
      : [];
  });
  const state = snapshot.states.find((p) => p.plotId === plotId);
  return (
    <section className="season-timeline" aria-label={t('Watch crop growth')}>
      <div className="timeline-heading">
        <div>
          <strong>{t('Watch crop growth')}</strong>
          <p>{t('Replay saved days. Your farm stays unchanged.')}</p>
        </div>
        <span className="badge">
          {t('Day')} {snapshot.day} · {dateLabel(snapshot.date)}
        </span>
      </div>
      <div className="timeline-controls">
        <button
          className="button"
          disabled={end === 0}
          onClick={() => {
            if (!playing && cursor >= end) onChange(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}{' '}
          {t(playing ? 'Pause replay' : 'Play growth')}
        </button>
        <input
          aria-label={t('Choose a saved day')}
          type="range"
          min={0}
          max={end}
          value={cursor}
          disabled={end === 0}
          onChange={(e) => {
            setPlaying(false);
            onChange(Number(e.target.value));
          }}
          aria-valuetext={`${t('Day')} ${snapshot.day}, ${dateLabel(snapshot.date)}`}
        />
        <select
          aria-label={t('Replay speed')}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
        {onCurrent && index >= 0 && (
          <button
            className="button button-outline"
            onClick={() => {
              setPlaying(false);
              onCurrent();
            }}
          >
            <RotateCcw size={16} />
            {t('Back to today')}
          </button>
        )}
      </div>
      {end === 0 ? (
        <p className="muted">{t('Advance the simulation to save more days.')}</p>
      ) : (
        <div className="stage-stops">
          {milestones.map((m) => (
            <button
              key={m.i}
              aria-pressed={cursor === m.i}
              onClick={() => {
                setPlaying(false);
                onChange(m.i);
              }}
            >
              {t(m.stage)}
              <small>
                {t('Day')} {history[m.i].day}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="timeline-events">
        <span>
          <CloudRain size={16} />
          {t('Rainfall')}: {(snapshot.weather?.rain || 0).toFixed(1)} mm
        </span>
        <span>
          <Droplets size={16} />
          {t('Water added')}: {(state?.balance.irrigation || 0).toFixed(1)} mm
        </span>
        <span>
          {t('Crop condition')}:{' '}
          {t(
            (state?.stress || 0) > 0.6
              ? 'High stress'
              : (state?.stress || 0) > 0.25
                ? 'Moderate stress'
                : 'Low stress',
          )}
        </span>
      </div>
    </section>
  );
}
