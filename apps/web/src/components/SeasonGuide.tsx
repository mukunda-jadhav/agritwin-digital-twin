import { useState } from 'react';
import { CloudRain, Sun, Sprout } from 'lucide-react';
import { t } from '../i18n';

const seasons = [
  {
    name: 'Kharif · Rainy season',
    months: 'Usually June–July sowing',
    icon: CloudRain,
    crops: ['Soybean', 'Cotton', 'Rice', 'Maize', 'Pigeon pea'],
    advice:
      'Wait for reliable monsoon rain and enough soil moisture. Choose a crop suited to your soil and local rainfall.',
  },
  {
    name: 'Rabi · Cool season',
    months: 'Usually October–November sowing',
    icon: Sprout,
    crops: ['Chickpea', 'Wheat', 'Sorghum'],
    advice:
      'Check water stored in the soil after the monsoon. Wheat usually needs assured irrigation; ask locally about rainfed chickpea or sorghum.',
  },
  {
    name: 'Summer · Hot season',
    months: 'Usually February–March sowing',
    icon: Sun,
    crops: ['Groundnut', 'Green gram', 'Maize'],
    advice:
      'Plan summer crops only when water is dependable. Heat and water availability matter more than the calendar alone.',
  },
] as const;
export function SeasonGuide() {
  const [selected, setSelected] = useState(0);
  const season = seasons[selected];
  return (
    <section className="card padded season-guide">
      <div className="section-heading">
        <div>
          <h2>{t('Which crop for which season?')}</h2>
          <p>{t('A simple starting guide for Maharashtra.')}</p>
        </div>
        <Sprout size={28} />
      </div>
      <div className="season-choices">
        {seasons.map((s, i) => (
          <button
            key={s.name}
            className={`button ${i === selected ? 'button-primary' : 'button-outline'}`}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
          >
            <s.icon size={18} />
            {t(s.name)}
          </button>
        ))}
      </div>
      <h3>{t(season.months)}</h3>
      <p>{t('Common crop choices')}:</p>
      <ul className="season-crops">
        {season.crops.map((crop) => (
          <li key={crop}>{t(crop)}</li>
        ))}
      </ul>
      <p>{t(season.advice)}</p>
      <details>
        <summary>{t('Before buying seeds')}</summary>
        <ol>
          <li>{t('Check your soil type and water supply.')}</li>
          <li>
            {t(
              'Ask your local KVK or agriculture officer about sowing dates and suitable varieties.',
            )}
          </li>
          <li>{t('Check seed cost, labour and a nearby market before choosing.')}</li>
        </ol>
        <p className="muted">
          {t(
            'This is a regional guide, not a field-specific recommendation. Dates vary by district, rainfall and crop variety. It does not automatically select or plant a crop.',
          )}
        </p>
        <p>
          <a
            href="https://www.icar.gov.in/index.php/en/node/17272"
            target="_blank"
            rel="noreferrer"
          >
            ICAR: Maharashtra
          </a>{' '}
          ·{' '}
          <a
            href="https://www.gazetteers.maharashtra.gov.in/cultural.maharashtra.gov.in/english/gazetteer/aurangabad/CHAP04/AGRICULTURAL%20SEASONS.htm"
            target="_blank"
            rel="noreferrer"
          >
            {t('Season reference')}
          </a>
        </p>
      </details>
    </section>
  );
}
