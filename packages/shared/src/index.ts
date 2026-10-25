import { z } from 'zod';
import { CROP_NAMES } from './crops';
export * from './crops';
export * from './lifecycle';
export const MODEL_VERSION = 'agritwin-maharashtra-v3';
export const soilSchema = z.enum(['Loam', 'Sandy', 'Clay']);
export type Soil = z.infer<typeof soilSchema>;
export const plotInput = z.object({
  name: z.string().trim().min(1).max(60),
  area: z.number().min(10).max(1000000),
  soil: soilSchema,
  method: z.enum(['Drip', 'Sprinkler', 'Flood']),
  plantingDate: z.string().date(),
  crop: z.enum(CROP_NAMES).optional(),
});
export const farmInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    location: z.string().trim().min(2).max(100),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    area: z.number().min(10).max(10000000),
    unit: z.enum(['m²', 'ha', 'acre']).default('acre'),
    plots: z.array(plotInput).min(1).max(24),
    boundary: z
      .array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
      .max(100)
      .optional(),
  })
  .refine((f) => f.plots.reduce((s, p) => s + p.area, 0) <= f.area, {
    message: 'Total plot area must not exceed farm area',
    path: ['area'],
  });
export type FarmInput = z.infer<typeof farmInput>;
export type Plot = z.infer<typeof plotInput> & { id: string };
export type Weather = {
  date: string;
  temperature: number;
  rain: number;
  et0: number;
  humidity: number;
  solar: number;
  source: 'forecast' | 'historical' | 'carried-forward' | 'synthetic';
  sourceDate?: string;
  observedSource?: 'forecast' | 'historical';
  provider?: string;
  fetchedAt?: string;
  timezone?: string;
};
export type PlotState = {
  plotId: string;
  water: number;
  gdd: number;
  age: number;
  growth: number;
  stress: number;
  stressTotal: number;
  yieldKg: number;
  waterLitres: number;
  stage: string;
  biomassKgM2?: number;
  harvestedKg?: number;
  harvestReviewed?: boolean;
  initialization?: {
    method: string;
    from: string;
    to: string;
    source: string;
    fetchedAt?: string;
    lowerMm: number;
    upperMm: number;
    assumption: string;
  };
  balance: {
    initial: number;
    rain: number;
    irrigation: number;
    loss: number;
    runoff: number;
    et: number;
    drainage: number;
    final: number;
  };
};
export type Snapshot = {
  id: string;
  date: string;
  day: number;
  version: number;
  states: PlotState[];
  weather: Weather | null;
};
export type Irrigation = {
  id: string;
  plotId: string;
  date: string;
  amount: number;
  interval: number;
  enabled: boolean;
  appliedDates: string[];
  kind: 'manual' | 'schedule';
};
export type Run = {
  id: string;
  modelVersion: string;
  status: 'paused' | 'running';
  speed: number;
  version: number;
  history: Snapshot[];
  events: Irrigation[];
  weather: Weather[];
  harvests?: { id: string; plotId: string; date: string; kg: number }[];
};
export type ScenarioInput = {
  name: string;
  days: number;
  rainMultiplier: number;
  temperatureDelta: number;
  irrigationMultiplier: number;
  interval: number;
  amount: number;
};
export const scenarioInput = z.object({
  name: z.string().trim().min(1).max(70),
  days: z.number().int().min(1).max(120),
  rainMultiplier: z.number().min(0).max(3),
  temperatureDelta: z.number().min(-10).max(10),
  irrigationMultiplier: z.number().min(0).max(2),
  interval: z.number().int().min(1).max(30),
  amount: z.number().min(0).max(80),
});
export type Scenario = {
  id: string;
  createdAt: string;
  config: ScenarioInput;
  baseline: Snapshot[];
  experiment: Snapshot[];
};
export type Farm = Omit<FarmInput, 'plots'> & {
  economics?: {
    plotId: string;
    pricePerKg: number | null;
    fixedCost: number;
    waterCostPerM3: number;
  }[];
  id: string;
  ownerId: string;
  plots: Plot[];
  run: Run;
  archives: Run[];
  scenarios: Scenario[];
  createdAt: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  sessionVersion?: number;
  firebaseUid?: string | null;
};
export type PublicUser = Omit<User, 'passwordHash'>;
export type Prediction = {
  plotId: string;
  amount: number;
  timing: string;
  stress: 'Low' | 'Moderate' | 'High';
  yieldKg: number;
  method: string;
  factors: string[];
};
