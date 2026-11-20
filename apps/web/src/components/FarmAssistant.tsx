import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Farm, Plot, Snapshot } from '@agritwin/shared';
import { api } from '../services/api';
import { t } from '../i18n';
import { Speak } from './Language';
import { dateLabel, fmt } from './common';

type Answer = {
  mode: 'ai' | 'guide';
  answer: string;
  evidence: {
    date: string;
    modelVersion: string;
    weatherSource: string;
    availableWaterPercent: number;
    stressPercent: number;
  };
  comparison?: {
    config: {
      days: number;
      amount: number;
      interval: number;
      irrigationMultiplier: number;
      rainMultiplier: number;
      temperatureDelta: number;
    };
    baseline: { additionalWaterLitres: number; modeledYieldKg: number; stressPercent: number };
    experiment: { additionalWaterLitres: number; modeledYieldKg: number; stressPercent: number };
    weatherSources: string[];
  };
};
type Turn = { question: string; result: Answer };
export function FarmAssistant({
  farm,
  plot,
  snapshot,
}: {
  farm: Farm;
  plot: Plot;
  snapshot: Snapshot;
}) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<'ai' | 'guide' | null>(null);
  const [question, setQuestion] = useState(''),
    [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setError('');
    api<{ mode: 'ai' | 'guide' }>(`/farms/${farm.id}/assistant`, { signal: abort.signal })
      .then((r) => setMode(r.mode))
      .catch(() => {
        if (!abort.signal.aborted) setError(t('Could not connect. Close and try again.'));
      });
    input.current?.focus();
    return () => abort.abort();
  }, [open, farm.id]);
  async function ask(text: string) {
    if (busy || !text.trim() || !mode) return;
    setBusy(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await api<Answer>(`/farms/${farm.id}/assistant`, {
        method: 'POST',
        signal: abort.signal,
        body: JSON.stringify({
          plotId: plot.id,
          snapshotId: snapshot.id,
          message: text,
          language: ['hi', 'mr'].includes(i18n.language) ? i18n.language : 'en',
          history: turns.slice(-3).flatMap((turn) => [
            { role: 'user', content: turn.question },
            { role: 'assistant', content: turn.result.answer.slice(0, 4000) },
          ]),
        }),
      });
      if (abort.signal.aborted) return;
      setTurns((previous) => [...previous, { question: text, result }].slice(-8));
      setQuestion('');
    } catch (e) {
      if (!abort.signal.aborted) setError(t((e as Error).message));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="card farm-assistant"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          controller.current?.abort();
          setBusy(false);
        }
      }}
    >
      <button
        className="assistant-toggle"
        aria-expanded={open}
        aria-controls="farm-assistant-panel"
        onClick={() => {
          setOpen(!open);
          if (open) {
            controller.current?.abort();
            setBusy(false);
          }
        }}
      >
        <MessageCircle size={23} aria-hidden="true" />
        <span>
          <strong>{t('Ask about my crop')}</strong>
          <small>{t('Simple answers, in your language')}</small>
        </span>
        {open && <X size={20} aria-hidden="true" />}
      </button>
      {open && (
        <div id="farm-assistant-panel" className="assistant-panel">
          <div className="assistant-context">
            <strong>{plot.name}</strong>
            <span>{dateLabel(snapshot.date)}</span>
            <span className="badge">
              {t(
                mode === 'ai'
                  ? 'AI assistant'
                  : mode === 'guide'
                    ? 'Basic guide · AI not connected'
                    : 'Connecting…',
              )}
            </span>
          </div>
          <p className="muted">
            {t(
              mode === 'ai'
                ? 'Your question and selected plot data are sent to OpenAI. Do not include personal details. Farm records stay unchanged.'
                : 'No API key needed. This guide explains saved values; it cannot answer open-ended questions.',
            )}
          </p>
          <div className="assistant-suggestions">
            {[
              'Does my crop need water?',
              'Why is my crop stressed?',
              'Compare 25% less water for 14 days, using 15 mm every 2 days.',
            ].map((s) => (
              <button
                key={s}
                className="button button-outline"
                disabled={busy || !mode}
                onClick={() => {
                  setQuestion(t(s));
                  void ask(t(s));
                }}
              >
                {t(s)}
              </button>
            ))}
          </div>
          <div
            className="assistant-conversation"
            role="log"
            aria-label={t('Crop conversation')}
            aria-live="polite"
            aria-relevant="additions"
          >
            {turns.map((turn, index) => (
              <article key={index}>
                <p className="assistant-question">{turn.question}</p>
                <div className="assistant-answer">
                  <span className="eyebrow">
                    {t(
                      turn.result.mode === 'ai' ? 'AI assistant' : 'Basic guide · AI not connected',
                    )}
                  </span>
                  <p>{turn.result.answer}</p>
                  {turn.result.comparison && (
                    <div className="assistant-comparison">
                      <strong>{t('Experiment preview')}</strong>
                      <p>
                        {turn.result.comparison.config.days} {t('days')} ·{' '}
                        {turn.result.comparison.config.amount} mm /{' '}
                        {turn.result.comparison.config.interval} {t('days')} ·{' '}
                        {fmt(turn.result.comparison.config.irrigationMultiplier * 100)}%{' '}
                        {t('of usual watering')}
                      </p>
                      <dl>
                        <dt>{t('Change in water used')}</dt>
                        <dd>
                          {fmt(
                            turn.result.comparison.experiment.additionalWaterLitres -
                              turn.result.comparison.baseline.additionalWaterLitres,
                          )}{' '}
                          L
                        </dd>
                        <dt>{t('Change in estimated yield')}</dt>
                        <dd>
                          {fmt(
                            turn.result.comparison.experiment.modeledYieldKg -
                              turn.result.comparison.baseline.modeledYieldKg,
                            1,
                          )}{' '}
                          kg
                        </dd>
                      </dl>
                      <p className="muted">
                        {t('Weather source')}:{' '}
                        {turn.result.comparison.weatherSources.map((s) => t(s)).join(', ')}
                      </p>
                      <Link to="/app/scenarios" className="text-button">
                        {t('Open scenario analysis')} →
                      </Link>
                    </div>
                  )}
                  <details>
                    <summary>{t('Why this answer?')}</summary>
                    <p>
                      {t('Saved day')}: {dateLabel(turn.result.evidence.date)} ·{' '}
                      {t('Available soil water')}: {turn.result.evidence.availableWaterPercent}% ·{' '}
                      {t('Crop stress')}: {turn.result.evidence.stressPercent}%
                    </p>
                    <p>
                      {t('Weather source')}: {t(turn.result.evidence.weatherSource)} ·{' '}
                      {turn.result.evidence.modelVersion}
                    </p>
                    <p>
                      {t(
                        'Model estimates, not field measurements. Check your field before acting.',
                      )}
                    </p>
                  </details>
                  <Speak text={turn.result.answer} />
                </div>
              </article>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <label htmlFor="crop-question">{t('Your question')}</label>
            <textarea
              ref={input}
              id="crop-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1200}
              rows={2}
              required
              disabled={busy}
            />
            <div className="assistant-actions">
              <small>{question.length}/1200</small>
              <button
                className="button button-primary"
                disabled={busy || !mode || !question.trim()}
              >
                <Send size={17} aria-hidden="true" />
                {t(busy ? 'Thinking…' : 'Ask')}
              </button>
            </div>
          </form>
          {busy && <p role="status">{t('Checking your saved crop data…')}</p>}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Link to="/app/scenarios" className="text-button">
            {t('Compare watering choices')} →
          </Link>
        </div>
      )}
    </section>
  );
}
