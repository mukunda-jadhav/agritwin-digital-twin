import { ChevronDown } from 'lucide-react';
import {
  RISK_ADVICE,
  THREATS,
  type RiskLevel,
  type Threat,
  type ThreatAssessment,
} from '@agritwin/shared';
import { t } from '../i18n';

const kindLabel: Record<Threat['kind'], string> = {
  fungal: 'Fungal disease',
  bacterial: 'Bacterial disease',
  viral: 'Virus',
  insect: 'Insect pest',
};
export const threatById = new Map(THREATS.map((th) => [th.id, th]));
const levelClass = (l: RiskLevel) => l.toLowerCase().replace(' ', '-');

function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  return (
    <svg
      className="threat-trend"
      viewBox={`0 0 ${values.length * 8} 24`}
      role="img"
      aria-label={`${t('Risk over the last days')}: ${values.join(', ')}`}
    >
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * 8 + 1}
          y={24 - Math.max(1, (v / 100) * 24)}
          width="6"
          height={Math.max(1, (v / 100) * 24)}
          rx="1"
        />
      ))}
    </svg>
  );
}

export function ThreatCard({ a }: { a: ThreatAssessment }) {
  const th = threatById.get(a.threatId)!;
  return (
    <article className={`card threat-card level-${levelClass(a.level)}`}>
      <div className="threat-head">
        <div>
          <h3>{th.name}</h3>
          <p className="muted">
            <em>{th.scientific}</em>
            {th.local && (
              <>
                {' · '}
                <span lang="mr">{th.local}</span>
              </>
            )}
          </p>
        </div>
        <span className="tiny-badge">{t(kindLabel[th.kind])}</span>
      </div>
      <div className="threat-risk">
        <div
          className="threat-meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={a.score}
          aria-label={th.name}
        >
          <span style={{ width: `${a.score}%` }} />
        </div>
        <strong>
          {t(a.level)} · {a.score}
        </strong>
        <Trend values={a.trend} />
      </div>
      <p className="threat-advice">{t(RISK_ADVICE[a.level])}</p>
      {a.status === 'insufficient-weather' && (
        <p className="muted">
          {t('Fewer than 3 days of weather so far, so this reading is only indicative.')}
        </p>
      )}
      <ul className="threat-drivers">
        {a.drivers.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <details className="threat-more">
        <summary>
          {t('Symptoms, scouting and management')} <ChevronDown size={14} />
        </summary>
        <p>
          <strong>{t('Susceptible stage')}:</strong> {a.window}
        </p>
        <p>
          <strong>{t('What to look for')}:</strong> {th.symptoms}
        </p>
        <p>
          <strong>{t('How to scout')}:</strong> {th.scouting}
        </p>
        <p>
          <strong>{t('Management')}:</strong>
        </p>
        <ul>
          {th.management.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}
