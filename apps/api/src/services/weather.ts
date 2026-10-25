import type { Farm, Weather } from '@agritwin/shared';
import { addDays, SOILS } from '../simulation/engine.js';

export class WeatherUnavailable extends Error {}

type ProviderSource = 'forecast' | 'historical';
const cache = new Map<string, { until: number; data: Weather[] }>();
const fields = [
  'temperature_2m_mean',
  'precipitation_sum',
  'et0_fao_evapotranspiration',
  'relative_humidity_2m_mean',
  'shortwave_radiation_sum',
];

function savedProviderWeather(farm: Pick<Farm, 'run' | 'archives' | 'scenarios'>) {
  const records = [farm.run, ...(farm.archives || [])]
    .flatMap((run) => [
      ...(run.weather || []),
      ...(run.history || []).flatMap((snapshot) => (snapshot.weather ? [snapshot.weather] : [])),
    ])
    .concat(
      (farm.scenarios || []).flatMap((scenario) =>
        scenario.baseline.flatMap((snapshot) => (snapshot.weather ? [snapshot.weather] : [])),
      ),
    );
  const byDate = new Map<string, Weather>();
  for (const record of records) {
    if (record.source === 'synthetic') continue;
    const date = record.source === 'carried-forward' ? record.sourceDate : record.date,
      source = record.source === 'carried-forward' ? record.observedSource : record.source;
    if (!date || (source !== 'forecast' && source !== 'historical')) continue;
    if (record.source !== 'carried-forward' || !byDate.has(date))
      byDate.set(date, { ...record, date, source });
  }
  return [...byDate.values()];
}

function parseProviderWeather(raw: any, source: ProviderSource, fetchedAt: string): Weather[] {
  if (!Array.isArray(raw.daily?.time)) return [];
  const rows: Weather[] = [];
  for (let i = 0; i < raw.daily.time.length; i++) {
    const date = raw.daily.time[i],
      values = fields.map((field) => raw.daily[field]?.[i]);
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      values.some((value) => typeof value !== 'number' || !Number.isFinite(value))
    )
      continue;
    const [temperature, rain, et0, humidity, solar] = values as number[];
    if (
      temperature < -90 ||
      temperature > 65 ||
      rain < 0 ||
      et0 < 0 ||
      humidity < 0 ||
      humidity > 100 ||
      solar < 0
    )
      continue;
    rows.push({
      date,
      temperature,
      rain,
      et0,
      humidity,
      solar,
      source,
      provider:
        source === 'historical' ? 'Open-Meteo historical reanalysis' : 'Open-Meteo forecast',
      fetchedAt,
      timezone: typeof raw.timezone === 'string' ? raw.timezone : 'UTC',
    });
  }
  return rows;
}

async function providerWeather(
  latitude: number,
  longitude: number,
  source: ProviderSource,
  start: string,
  end: string,
  today: string,
): Promise<Weather[]> {
  const key = JSON.stringify([
    latitude,
    longitude,
    source,
    source === 'historical' ? start : today,
    source === 'historical' ? end : '',
  ]);
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return structuredClone(cached.data);

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: fields.join(','),
    timezone: 'auto',
  });
  if (source === 'historical') {
    params.set('start_date', start);
    params.set('end_date', end);
  } else {
    params.set('past_days', '7');
    params.set('forecast_days', '16');
  }

  let rows: Weather[] = [];
  try {
    const response = await fetch(
      `https://${source === 'historical' ? 'archive-api' : 'api'}.open-meteo.com/v1/${source === 'historical' ? 'archive' : 'forecast'}?${params}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (response.ok)
      rows = parseProviderWeather(await response.json(), source, new Date().toISOString());
  } catch {
    // Existing provider observations can still carry a run through a temporary outage.
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { until: Date.now() + (rows.length ? 30 : 2) * 60 * 1000, data: rows });
  return rows;
}

/** Fetch real provider weather where available, then carry the most recent provider record forward. */
export async function weatherFor(
  farm: Pick<Farm, 'latitude' | 'longitude' | 'run' | 'archives' | 'scenarios'>,
  start: string,
  days = 16,
): Promise<Weather[]> {
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  if (!dates.length) return [];

  const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    cutoff = addDays(today, -6),
    forecastEnd = addDays(today, 15),
    historyDates = dates.filter((date) => date <= cutoff),
    actual = new Map(savedProviderWeather(farm).map((weather) => [weather.date, weather]));

  if (historyDates.length) {
    const history = await providerWeather(
      farm.latitude,
      farm.longitude,
      'historical',
      historyDates[0],
      historyDates.at(-1)!,
      today,
    );
    for (const weather of history) actual.set(weather.date, weather);
  }

  // Query the live forecast even when the requested dates are beyond it, so its last real day
  // can be carried forward for a future planting date or a long simulation step.
  if (dates.some((date) => date > cutoff || date > forecastEnd)) {
    const forecast = await providerWeather(
      farm.latitude,
      farm.longitude,
      'forecast',
      today,
      today,
      today,
    );
    for (const weather of forecast) actual.set(weather.date, weather);
  }

  const ordered = [...actual.values()].sort((a, b) => a.date.localeCompare(b.date));
  let lastObserved: Weather | undefined;
  const result: Weather[] = [];
  for (const date of dates) {
    const exact = actual.get(date);
    if (exact) {
      lastObserved = exact;
      result.push(exact);
      continue;
    }
    if (!lastObserved) lastObserved = ordered.filter((row) => row.date <= date).at(-1);
    if (!lastObserved)
      throw new WeatherUnavailable(
        `No provider weather history is available before ${date}; a real starting weather record is required.`,
      );

    // Rainfall is a daily accumulation, so do not repeat yesterday's rain on every missing day.
    result.push({
      ...lastObserved,
      date,
      rain: 0,
      source: 'carried-forward',
      sourceDate: lastObserved.date,
      observedSource: lastObserved.source === 'historical' ? 'historical' : 'forecast',
    });
  }
  return result;
}

export function requireWeatherCoverage(weather: Weather[], start: string, days: number) {
  const missing = Array.from({ length: days }, (_, i) => addDays(start, i)).find(
    (date) => !weather.some((row) => row.date === date),
  );
  if (missing) throw new WeatherUnavailable(`Weather could not be prepared for ${missing}.`);
}

/** Optional Open-Meteo gridded root-zone indicator; this is model output, not a field sensor. */
export async function providerSoilWater(
  farm: Pick<Farm, 'latitude' | 'longitude'>,
  date: string,
  soil: keyof typeof SOILS,
  rootZone: { field: number; wilt: number },
): Promise<{ water: number; source: string } | null> {
  const params = new URLSearchParams({
    latitude: String(farm.latitude),
    longitude: String(farm.longitude),
    hourly: 'soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm',
    start_date: date,
    end_date: date,
    timezone: 'auto',
  });
  try {
    const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
        signal: AbortSignal.timeout(12000),
      }),
      raw: any = response.ok ? await response.json() : null,
      h = raw?.hourly;
    if (!Array.isArray(h?.time)) return null;
    const layers = [
      'soil_moisture_0_to_7cm',
      'soil_moisture_7_to_28cm',
      'soil_moisture_28_to_100cm',
    ].map((key) => h[key]);
    if (layers.some((values) => !Array.isArray(values))) return null;
    const values = layers.map((items) => {
      const valid = items.filter(
        (value: unknown) => typeof value === 'number' && Number.isFinite(value),
      );
      return valid.length
        ? valid.reduce((sum: number, value: number) => sum + value, 0) / valid.length
        : NaN;
    });
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) return null;
    const volumetric = (values[0] * 0.07 + values[1] * 0.21 + values[2] * 0.02) / 0.3,
      wilting = SOILS[soil].wilt / 300,
      fieldCapacity = SOILS[soil].field / 300,
      fraction = Math.max(0, Math.min(1, (volumetric - wilting) / (fieldCapacity - wilting)));
    return {
      water: rootZone.wilt + fraction * (rootZone.field - rootZone.wilt),
      source: 'Open-Meteo historical gridded soil-moisture model (Best Match)',
    };
  } catch {
    return null;
  }
}
