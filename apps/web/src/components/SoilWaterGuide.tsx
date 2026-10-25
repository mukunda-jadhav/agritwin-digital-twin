import type { Plot } from '@agritwin/shared';
import { t } from '../i18n';

export const soilHelp = {
  Loam: 'A balanced soil that holds water moderately and drains moderately.',
  Sandy:
    'Loose, gritty soil. Water drains quickly, so smaller, more frequent applications may be needed.',
  Clay: 'Fine, sticky soil. It drains slowly; large applications can cause runoff.',
};
export const waterHelp = {
  Drip: 'Water goes through pipes near plant roots. The model delivers 90% of applied water before runoff.',
  Sprinkler: 'Water is sprayed over the crop. The model delivers 75% before runoff.',
  Flood: 'Water flows over the soil surface. The model delivers 60% before runoff.',
};
export const methodEfficiency = { Drip: 0.9, Sprinkler: 0.75, Flood: 0.6 };
export function SoilWaterGuide({ soil, method }: { soil: Plot['soil']; method: Plot['method'] }) {
  return (
    <div className="soil-water-guide">
      <div>
        <strong>
          {t('Soil')}: {t(soil)}
        </strong>
        <p>{t(soilHelp[soil])}</p>
      </div>
      <div>
        <strong>
          {t('Watering system')}: {t(method)}
        </strong>
        <p>{t(waterHelp[method])}</p>
      </div>
      <small>
        {t(
          'These are model assumptions. Select the soil and system used on your farm; the map cannot identify them.',
        )}
      </small>
    </div>
  );
}
