export const CROP_NAMES = [
  'Wheat',
  'Maize',
  'Tomato',
  'Soybean',
  'Cotton',
  'Tur',
  'Jowar',
  'Bajra',
  'Gram',
  'Rice',
  'Groundnut',
  'Sugarcane',
] as const;
export type CropName = (typeof CROP_NAMES)[number];
export type CropForm = 'grass' | 'broadleaf' | 'fruit' | 'fiber' | 'groundnut' | 'cane';
export type CropConfig = {
  name: CropName;
  variety: string;
  baseTemperature: number;
  maxTemperature: number;
  heatThreshold: number;
  maturityGdd: number;
  harvestGdd: number;
  reproductiveGdd: number;
  potentialKgM2: number;
  maxHeight: number;
  rowSpacing: number;
  plantSpacing: number;
  rootDepthM: number;
  kc: [number, number, number];
  rue: number;
  maxLai: number;
  harvestIndex: number;
  dryMatterFraction: number;
  form: CropForm;
  leafWidth: number;
  headGdd: number;
  stages: { gdd: number; name: string }[];
  planning: string;
};

/*
 * Generic reference profiles for the main Maharashtra crops. Phenology and
 * yield coefficients are starting model parameters, not cultivar guarantees.
 * Weather drives daily development; local cultivar/field calibration is still
 * needed before using estimates for farm decisions.
 */
export const CROPS: Record<CropName, CropConfig> = {
  Wheat: {
    name: 'Wheat', variety: 'Spring wheat — reference profile', baseTemperature: 0,
    maxTemperature: 26, heatThreshold: 30, maturityGdd: 2000, harvestGdd: 2000,
    reproductiveGdd: 1450, potentialKgM2: 0.65, maxHeight: 0.95, rowSpacing: 0.22,
    plantSpacing: 0.1, rootDepthM: 1, kc: [0.3, 1.15, 0.3], rue: 2.8, maxLai: 4.5,
    harvestIndex: 0.45, dryMatterFraction: 0.86, form: 'grass', leafWidth: 0.025, headGdd: 1100,
    planning: '110–150 days', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 90, name: 'Emergence' },
      { gdd: 180, name: 'Tillering' }, { gdd: 450, name: 'Stem elongation' },
      { gdd: 800, name: 'Booting' }, { gdd: 1100, name: 'Heading' },
      { gdd: 1300, name: 'Flowering' }, { gdd: 1450, name: 'Grain filling' },
      { gdd: 2000, name: 'Physiological maturity' },
    ],
  },
  Maize: {
    name: 'Maize', variety: 'Grain maize — reference profile', baseTemperature: 10,
    maxTemperature: 30, heatThreshold: 35, maturityGdd: 1450, harvestGdd: 1450,
    reproductiveGdd: 950, potentialKgM2: 0.9, maxHeight: 2.3, rowSpacing: 0.75,
    plantSpacing: 0.25, rootDepthM: 1, kc: [0.3, 1.2, 0.35], rue: 3.3, maxLai: 5,
    harvestIndex: 0.5, dryMatterFraction: 0.85, form: 'grass', leafWidth: 0.09, headGdd: 850,
    planning: '90–130 days', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 70, name: 'Emergence' },
      { gdd: 140, name: 'Vegetative leaf stages' }, { gdd: 850, name: 'Tasseling' },
      { gdd: 950, name: 'Silking' }, { gdd: 1100, name: 'Grain filling' },
      { gdd: 1450, name: 'Physiological maturity' },
    ],
  },
  Tomato: {
    name: 'Tomato', variety: 'Field tomato — reference profile', baseTemperature: 10,
    maxTemperature: 30, heatThreshold: 32, maturityGdd: 2200, harvestGdd: 1450,
    reproductiveGdd: 850, potentialKgM2: 5, maxHeight: 1.15, rowSpacing: 1,
    plantSpacing: 0.5, rootDepthM: 0.6, kc: [0.6, 1.15, 0.8], rue: 2.7, maxLai: 3.5,
    harvestIndex: 0.6, dryMatterFraction: 0.06, form: 'fruit', leafWidth: 0.23, headGdd: 700,
    planning: '90–150 days; harvest period varies', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 80, name: 'Seedling' },
      { gdd: 200, name: 'Vegetative growth' }, { gdd: 500, name: 'Flowering' },
      { gdd: 700, name: 'Fruit set' }, { gdd: 850, name: 'Fruit development' },
      { gdd: 1150, name: 'Ripening' }, { gdd: 1450, name: 'Harvesting' },
      { gdd: 2200, name: 'Maximum development' },
    ],
  },
  Soybean: {
    name: 'Soybean', variety: 'Soybean — Maharashtra reference profile', baseTemperature: 10,
    maxTemperature: 30, heatThreshold: 35, maturityGdd: 1600, harvestGdd: 1350,
    reproductiveGdd: 700, potentialKgM2: 0.35, maxHeight: 0.9, rowSpacing: 0.45,
    plantSpacing: 0.08, rootDepthM: 0.6, kc: [0.4, 1.1, 0.45], rue: 3.2, maxLai: 4,
    harvestIndex: 0.42, dryMatterFraction: 0.9, form: 'broadleaf', leafWidth: 0.08, headGdd: 700,
    planning: '90–120 days', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 100, name: 'Emergence' },
      { gdd: 350, name: 'Vegetative growth' }, { gdd: 700, name: 'Flowering' },
      { gdd: 900, name: 'Pod development' }, { gdd: 1250, name: 'Seed filling' },
      { gdd: 1600, name: 'Physiological maturity' },
    ],
  },
  Cotton: {
    name: 'Cotton', variety: 'Rainfed cotton — Maharashtra reference profile', baseTemperature: 15,
    maxTemperature: 32, heatThreshold: 38, maturityGdd: 2600, harvestGdd: 2100,
    reproductiveGdd: 1100, potentialKgM2: 0.25, maxHeight: 1.5, rowSpacing: 0.9,
    plantSpacing: 0.45, rootDepthM: 1.2, kc: [0.35, 1.2, 0.7], rue: 2.8, maxLai: 3.5,
    harvestIndex: 0.35, dryMatterFraction: 0.85, form: 'fiber', leafWidth: 0.13, headGdd: 1250,
    planning: '150–180 days; picking period varies', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 150, name: 'Emergence' },
      { gdd: 600, name: 'Vegetative growth' }, { gdd: 1000, name: 'Squaring' },
      { gdd: 1250, name: 'Flowering' }, { gdd: 1700, name: 'Boll development' },
      { gdd: 2200, name: 'Boll opening' }, { gdd: 2600, name: 'Maximum development' },
    ],
  },
  Tur: {
    name: 'Tur', variety: 'Pigeonpea — Maharashtra reference profile', baseTemperature: 10,
    maxTemperature: 30, heatThreshold: 35, maturityGdd: 2400, harvestGdd: 1950,
    reproductiveGdd: 1250, potentialKgM2: 0.22, maxHeight: 2.1, rowSpacing: 0.75,
    plantSpacing: 0.25, rootDepthM: 1.5, kc: [0.35, 1.05, 0.5], rue: 2.8, maxLai: 3.5,
    harvestIndex: 0.35, dryMatterFraction: 0.9, form: 'broadleaf', leafWidth: 0.07, headGdd: 1250,
    planning: '150–180 days; variety and sowing date matter', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 120, name: 'Emergence' },
      { gdd: 500, name: 'Branching' }, { gdd: 1050, name: 'Flowering' },
      { gdd: 1450, name: 'Pod development' }, { gdd: 1900, name: 'Seed filling' },
      { gdd: 2400, name: 'Physiological maturity' },
    ],
  },
  Jowar: {
    name: 'Jowar', variety: 'Sorghum — Maharashtra reference profile', baseTemperature: 10,
    maxTemperature: 30, heatThreshold: 38, maturityGdd: 1500, harvestGdd: 1250,
    reproductiveGdd: 750, potentialKgM2: 0.35, maxHeight: 2, rowSpacing: 0.45,
    plantSpacing: 0.15, rootDepthM: 1.2, kc: [0.35, 1.05, 0.55], rue: 3, maxLai: 4,
    harvestIndex: 0.38, dryMatterFraction: 0.88, form: 'grass', leafWidth: 0.06, headGdd: 800,
    planning: '100–130 days; kharif and rabi types differ', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 100, name: 'Emergence' },
      { gdd: 350, name: 'Leaf development' }, { gdd: 700, name: 'Booting' },
      { gdd: 800, name: 'Flowering' }, { gdd: 1050, name: 'Grain filling' },
      { gdd: 1500, name: 'Physiological maturity' },
    ],
  },
  Bajra: {
    name: 'Bajra', variety: 'Pearl millet — Maharashtra reference profile', baseTemperature: 10,
    maxTemperature: 32, heatThreshold: 40, maturityGdd: 1200, harvestGdd: 1000,
    reproductiveGdd: 650, potentialKgM2: 0.28, maxHeight: 1.8, rowSpacing: 0.45,
    plantSpacing: 0.12, rootDepthM: 1.2, kc: [0.3, 1.05, 0.45], rue: 3.2, maxLai: 3.5,
    harvestIndex: 0.4, dryMatterFraction: 0.88, form: 'grass', leafWidth: 0.045, headGdd: 650,
    planning: '75–100 days; variety and sowing date matter', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 90, name: 'Emergence' },
      { gdd: 300, name: 'Leaf development' }, { gdd: 600, name: 'Booting' },
      { gdd: 650, name: 'Flowering' }, { gdd: 850, name: 'Grain filling' },
      { gdd: 1200, name: 'Physiological maturity' },
    ],
  },
  Gram: {
    name: 'Gram', variety: 'Chickpea — Maharashtra reference profile', baseTemperature: 5,
    maxTemperature: 28, heatThreshold: 32, maturityGdd: 1350, harvestGdd: 1120,
    reproductiveGdd: 700, potentialKgM2: 0.24, maxHeight: 0.65, rowSpacing: 0.3,
    plantSpacing: 0.1, rootDepthM: 0.8, kc: [0.4, 1.0, 0.35], rue: 2.7, maxLai: 3,
    harvestIndex: 0.4, dryMatterFraction: 0.9, form: 'broadleaf', leafWidth: 0.065, headGdd: 700,
    planning: '100–130 days', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 100, name: 'Emergence' },
      { gdd: 350, name: 'Branching' }, { gdd: 650, name: 'Flowering' },
      { gdd: 850, name: 'Pod development' }, { gdd: 1100, name: 'Seed filling' },
      { gdd: 1350, name: 'Physiological maturity' },
    ],
  },
  Rice: {
    name: 'Rice', variety: 'Rice — Maharashtra reference profile', baseTemperature: 10,
    maxTemperature: 30, heatThreshold: 35, maturityGdd: 1900, harvestGdd: 1600,
    reproductiveGdd: 1000, potentialKgM2: 0.65, maxHeight: 1.1, rowSpacing: 0.2,
    plantSpacing: 0.15, rootDepthM: 0.45, kc: [0.7, 1.2, 0.9], rue: 2.8, maxLai: 5,
    harvestIndex: 0.48, dryMatterFraction: 0.86, form: 'grass', leafWidth: 0.03, headGdd: 1050,
    planning: '110–150 days; season and variety matter', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 120, name: 'Seedling' },
      { gdd: 450, name: 'Tillering' }, { gdd: 900, name: 'Stem elongation' },
      { gdd: 1050, name: 'Heading' }, { gdd: 1250, name: 'Flowering' },
      { gdd: 1500, name: 'Grain filling' }, { gdd: 1900, name: 'Physiological maturity' },
    ],
  },
  Groundnut: {
    name: 'Groundnut', variety: 'Groundnut — Maharashtra reference profile', baseTemperature: 10,
    maxTemperature: 30, heatThreshold: 35, maturityGdd: 1550, harvestGdd: 1300,
    reproductiveGdd: 700, potentialKgM2: 0.4, maxHeight: 0.55, rowSpacing: 0.3,
    plantSpacing: 0.1, rootDepthM: 0.8, kc: [0.4, 1.15, 0.6], rue: 2.8, maxLai: 3.5,
    harvestIndex: 0.45, dryMatterFraction: 0.9, form: 'groundnut', leafWidth: 0.055, headGdd: 700,
    planning: '100–130 days; season and variety matter', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 100, name: 'Emergence' },
      { gdd: 400, name: 'Branching' }, { gdd: 650, name: 'Flowering' },
      { gdd: 750, name: 'Pegging' }, { gdd: 1050, name: 'Pod filling' },
      { gdd: 1550, name: 'Physiological maturity' },
    ],
  },
  Sugarcane: {
    name: 'Sugarcane', variety: 'Plant cane — Maharashtra reference profile', baseTemperature: 12,
    maxTemperature: 32, heatThreshold: 38, maturityGdd: 4200, harvestGdd: 3600,
    reproductiveGdd: 1000, potentialKgM2: 10, maxHeight: 3.2, rowSpacing: 1.2,
    plantSpacing: 0.3, rootDepthM: 1.2, kc: [0.4, 1.25, 0.75], rue: 3, maxLai: 5,
    harvestIndex: 0.9, dryMatterFraction: 0.25, form: 'cane', leafWidth: 0.055, headGdd: 1000,
    planning: '300–360 days; planting season and ratoon status matter', stages: [
      { gdd: 0, name: 'Germination' }, { gdd: 450, name: 'Tillering' },
      { gdd: 1100, name: 'Grand growth' }, { gdd: 2500, name: 'Cane development' },
      { gdd: 3600, name: 'Ripening' }, { gdd: 4200, name: 'Harvest maturity' },
    ],
  },
};

export function cropFor(crop?: string) {
  return CROPS[crop as CropName] || CROPS.Tomato;
}

export function cropStage(crop: CropConfig, gdd: number) {
  return [...crop.stages].reverse().find((stage) => gdd >= stage.gdd)?.name || 'Germination';
}
