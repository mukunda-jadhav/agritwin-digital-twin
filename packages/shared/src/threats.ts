import { CROPS, cropStage, type CropName } from './crops';

/*
 * Crop health knowledge base and risk model.
 *
 * IMPORTANT: this is a weather-and-stage RISK INDEX, not a diagnosis and not a
 * count of pests or infected plants. It estimates how favourable recent weather
 * and the crop's current growth stage are for each threat, using generalised
 * epidemiological ranges (temperature, humidity, rain, stress). Ranges are
 * reference assumptions drawn from standard crop-protection literature and must
 * be reviewed by a local agronomist (KVK / state agricultural university) before
 * being used for spray decisions. Daily weather is regional provider data, not
 * in-field leaf-wetness, so humidity and rain are proxies.
 */

export type ThreatKind = 'fungal' | 'bacterial' | 'viral' | 'insect';
export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Very high';
export type WeatherMode = 'wet' | 'dry' | 'neutral';

export type Threat = {
  id: string;
  name: string;
  scientific: string;
  /** Marathi name, only where well established; otherwise omitted. */
  local?: string;
  kind: ThreatKind;
  /** crop → susceptible window as a fraction (0–1) of the crop's maturity GDD */
  crops: Partial<Record<CropName, [number, number]>>;
  /** mean daily air temperature (°C): 0 favourability at min/max, 1 between optLow and optHigh */
  temp: { min: number; optLow: number; optHigh: number; max: number };
  /** mean daily relative humidity (%): 0 at min, 1 at full */
  humidity?: { min: number; full: number };
  /** wet: humid, rainy weather favours it. dry: warm, dry weather favours it. neutral: temperature only. */
  mode: WeatherMode;
  /** extra risk multiplier per unit of modelled water stress (0–1) */
  stressBoost?: number;
  /** extra risk when the root zone is above field capacity */
  waterlogging?: boolean;
  /** spread by an insect vector, so weather alone cannot show how much is present */
  vectorBorne?: boolean;
  symptoms: string;
  scouting: string;
  management: string[];
};

const IPM_NOTE =
  'Spray only when scouting counts reach the economic threshold set by your state agricultural university, and only products registered for this crop; follow the label.';

export const THREATS: Threat[] = [
  /* ---------------- Wheat ---------------- */
  {
    id: 'wheat-leaf-rust',
    name: 'Wheat leaf (brown) rust',
    scientific: 'Puccinia triticina',
    local: 'तांबेरा',
    kind: 'fungal',
    crops: { Wheat: [0.2, 0.85] },
    temp: { min: 8, optLow: 15, optHigh: 22, max: 30 },
    humidity: { min: 60, full: 85 },
    mode: 'wet',
    symptoms:
      'Small round orange-brown pustules scattered on the upper leaf surface that rub off as powder.',
    scouting:
      'Check 20 plants along a diagonal; look at flag leaf and the leaf below it. Note the percentage of leaf area covered.',
    management: [
      'Grow rust-resistant, locally recommended varieties and avoid a single variety over large areas.',
      'Avoid late sowing and excess nitrogen, which keep the canopy soft and humid.',
      'Destroy volunteer wheat and self-sown plants before the season.',
      IPM_NOTE,
    ],
  },
  {
    id: 'wheat-powdery-mildew',
    name: 'Wheat powdery mildew',
    scientific: 'Blumeria graminis f. sp. tritici',
    local: 'भुरी',
    kind: 'fungal',
    crops: { Wheat: [0.15, 0.7] },
    temp: { min: 8, optLow: 15, optHigh: 22, max: 27 },
    humidity: { min: 70, full: 90 },
    mode: 'wet',
    symptoms:
      'White powdery colonies on lower leaves and sheaths that spread upward; tissue yellows beneath.',
    scouting: 'Inspect lower leaves of dense, well-fertilised patches first.',
    management: [
      'Use tolerant varieties and keep seed rate and nitrogen moderate to avoid dense canopies.',
      'Remove infected volunteer plants and crop residue.',
      IPM_NOTE,
    ],
  },
  {
    id: 'wheat-aphid',
    name: 'Wheat aphids',
    scientific: 'Sitobion avenae, Rhopalosiphum maidis',
    kind: 'insect',
    crops: { Wheat: [0.5, 0.85] },
    temp: { min: 8, optLow: 15, optHigh: 25, max: 32 },
    mode: 'neutral',
    symptoms:
      'Colonies of small green or dark insects on ear heads and flag leaves; sticky honeydew and sooty mould.',
    scouting:
      'Count aphids on ear heads of 20 tillers at heading to milk stage; check for natural enemies such as ladybirds.',
    management: [
      'Conserve ladybird beetles and hoverflies; avoid broad-spectrum sprays that kill them.',
      'Avoid excess nitrogen.',
      IPM_NOTE,
    ],
  },

  /* ---------------- Maize ---------------- */
  {
    id: 'maize-fall-armyworm',
    name: 'Fall armyworm',
    scientific: 'Spodoptera frugiperda',
    local: 'लष्करी अळी',
    kind: 'insect',
    crops: { Maize: [0.03, 0.65] },
    temp: { min: 15, optLow: 24, optHigh: 32, max: 38 },
    mode: 'dry',
    symptoms:
      'Ragged window-pane feeding on young leaves, then shot-holes; sawdust-like frass inside the whorl.',
    scouting:
      'Check 5 plants at each of 10 spots. Look in the whorl for larvae and fresh frass; use pheromone traps for moth catches.',
    management: [
      'Sow on time and in one block with neighbours so plants are at the same stage.',
      'Install pheromone traps for early warning and hand-pick egg masses and young larvae.',
      'Biopesticides (for example neem-based or NPV products) work best on small larvae.',
      IPM_NOTE,
    ],
  },
  {
    id: 'maize-turcicum-blight',
    name: 'Turcicum leaf blight',
    scientific: 'Exserohilum turcicum',
    local: 'करपा',
    kind: 'fungal',
    crops: { Maize: [0.2, 0.85] },
    temp: { min: 14, optLow: 18, optHigh: 27, max: 31 },
    humidity: { min: 70, full: 90 },
    mode: 'wet',
    symptoms:
      'Long cigar-shaped grey-green to tan lesions on leaves, starting on lower leaves and moving up.',
    scouting:
      'Look at the ear leaf and the leaves above and below it; note how many plants have lesions above the ear.',
    management: [
      'Plant resistant or tolerant hybrids and rotate away from maize.',
      'Bury or remove infected crop residue after harvest.',
      'Keep plant population and nitrogen balanced to avoid prolonged leaf wetness.',
      IPM_NOTE,
    ],
  },
  {
    id: 'maize-stem-borer',
    name: 'Maize stem borer',
    scientific: 'Chilo partellus',
    kind: 'insect',
    crops: { Maize: [0.05, 0.5] },
    temp: { min: 18, optLow: 25, optHigh: 30, max: 36 },
    mode: 'neutral',
    symptoms: 'Pin-hole damage on leaves, dead heart in young plants, tunnelling in stems.',
    scouting: 'Count plants with shot-hole damage or dead heart in 10 rows of 5 m.',
    management: [
      'Remove and destroy stubble after harvest.',
      'Release Trichogramma egg parasitoids where recommended and use pheromone traps for monitoring.',
      IPM_NOTE,
    ],
  },

  /* ---------------- Tomato ---------------- */
  {
    id: 'tomato-early-blight',
    name: 'Tomato early blight',
    scientific: 'Alternaria solani',
    kind: 'fungal',
    crops: { Tomato: [0.1, 0.8] },
    temp: { min: 14, optLow: 24, optHigh: 29, max: 35 },
    humidity: { min: 70, full: 90 },
    mode: 'wet',
    symptoms:
      'Dark brown spots with concentric rings (target-board pattern) on older leaves, then stems and fruit shoulders.',
    scouting: 'Check the oldest leaves first, every 3–4 days when weather is humid.',
    management: [
      'Rotate with non-solanaceous crops and use clean seedlings.',
      'Stake plants, avoid overhead irrigation and remove infected lower leaves.',
      'Mulch to reduce soil splash.',
      IPM_NOTE,
    ],
  },
  {
    id: 'tomato-late-blight',
    name: 'Tomato late blight',
    scientific: 'Phytophthora infestans',
    kind: 'fungal',
    crops: { Tomato: [0.1, 0.8] },
    temp: { min: 8, optLow: 12, optHigh: 22, max: 26 },
    humidity: { min: 85, full: 95 },
    mode: 'wet',
    symptoms:
      'Large greasy water-soaked patches on leaves that turn brown; white growth underneath in humid air; firm brown rot on fruit.',
    scouting:
      'Look after cool, cloudy, drizzly spells. It can spread across the field in a few days.',
    management: [
      'Use certified seedlings and avoid planting near potato.',
      'Improve airflow and drainage; irrigate in the morning, not the evening.',
      'Remove and destroy infected plants early.',
      IPM_NOTE,
    ],
  },
  {
    id: 'tomato-leaf-curl',
    name: 'Tomato leaf curl virus (whitefly-spread)',
    scientific: 'Begomovirus; vector Bemisia tabaci',
    kind: 'viral',
    vectorBorne: true,
    crops: { Tomato: [0.02, 0.45] },
    temp: { min: 20, optLow: 27, optHigh: 33, max: 38 },
    mode: 'dry',
    stressBoost: 0.4,
    symptoms: 'Upward curling and crinkling of leaves, stunted bushy plants, flowers drop.',
    scouting:
      'Use yellow sticky traps; count whiteflies on the underside of young leaves. Rogue out curled plants early.',
    management: [
      'Raise seedlings under insect-proof net and use resistant or tolerant hybrids.',
      'Use yellow sticky traps and border crops; remove infected plants and weeds that host whitefly.',
      'Reflective mulch can reduce early whitefly landing.',
      IPM_NOTE,
    ],
  },
  {
    id: 'tomato-fruit-borer',
    name: 'Tomato fruit borer',
    scientific: 'Helicoverpa armigera',
    local: 'घाटेअळी',
    kind: 'insect',
    crops: { Tomato: [0.23, 0.75] },
    temp: { min: 15, optLow: 25, optHigh: 32, max: 38 },
    mode: 'neutral',
    symptoms: 'Round entry holes in green fruit, hollowed fruit with frass, caterpillars inside.',
    scouting: 'Use pheromone traps; count eggs and larvae on 20 plants; inspect fruit clusters.',
    management: [
      'Grow trap crops such as marigold around the field and use pheromone traps.',
      'Collect and destroy damaged fruit; hand-pick larvae.',
      'HaNPV and Bt-based products target young larvae.',
      IPM_NOTE,
    ],
  },

  /* ---------------- Soybean ---------------- */
  {
    id: 'soybean-rust',
    name: 'Soybean rust',
    scientific: 'Phakopsora pachyrhizi',
    local: 'तांबेरा',
    kind: 'fungal',
    crops: { Soybean: [0.35, 0.9] },
    temp: { min: 10, optLow: 18, optHigh: 26, max: 30 },
    humidity: { min: 75, full: 90 },
    mode: 'wet',
    symptoms:
      'Tiny tan to reddish-brown lesions on the underside of leaves with raised pustules; early leaf yellowing and drop.',
    scouting:
      'Look at the lower leaves from flowering onward, especially after long wet, cloudy spells.',
    management: [
      'Sow tolerant varieties on time; avoid very late sowing.',
      'Scout from flowering and remove volunteer soybean.',
      IPM_NOTE,
    ],
  },
  {
    id: 'soybean-ymv',
    name: 'Soybean yellow mosaic (whitefly-spread)',
    scientific: 'Mungbean yellow mosaic India virus; vector Bemisia tabaci',
    kind: 'viral',
    vectorBorne: true,
    crops: { Soybean: [0.03, 0.5] },
    temp: { min: 20, optLow: 27, optHigh: 33, max: 38 },
    mode: 'dry',
    stressBoost: 0.3,
    symptoms: 'Bright yellow patches among green areas on leaves, reduced pod set.',
    scouting:
      'Use yellow sticky traps; walk the field in the first 5 weeks and uproot infected plants.',
    management: [
      'Use resistant varieties and certified seed; control weeds that host whitefly.',
      'Rogue out infected seedlings early.',
      IPM_NOTE,
    ],
  },
  {
    id: 'soybean-girdle-beetle',
    name: 'Girdle beetle',
    scientific: 'Oberea brevis',
    local: 'चक्रभुंगा',
    kind: 'insect',
    crops: { Soybean: [0.15, 0.6] },
    temp: { min: 20, optLow: 24, optHigh: 30, max: 35 },
    humidity: { min: 60, full: 85 },
    mode: 'wet',
    symptoms: 'Two parallel rings cut around the stem or petiole; upper part wilts and dries.',
    scouting: 'Count girdled plants and petioles in 10 spots; start 3–4 weeks after sowing.',
    management: [
      'Sow at the recommended time and keep the field weed-free.',
      'Remove and destroy girdled parts, and destroy stubble after harvest.',
      IPM_NOTE,
    ],
  },

  /* ---------------- Cotton ---------------- */
  {
    id: 'cotton-pink-bollworm',
    name: 'Pink bollworm',
    scientific: 'Pectinophora gossypiella',
    local: 'गुलाबी बोंडअळी',
    kind: 'insect',
    crops: { Cotton: [0.4, 0.95] },
    temp: { min: 18, optLow: 25, optHigh: 32, max: 37 },
    mode: 'neutral',
    symptoms:
      'Rosette flowers, tiny entry holes in green bolls, damaged and stained lint, larvae inside seeds.',
    scouting:
      'Use pheromone traps from squaring; cut open 20 green bolls per plot each week and note live larvae.',
    management: [
      'Sow within the recommended window and avoid long-duration crops that keep bolls through winter.',
      'Install pheromone traps in every field for early warning.',
      'Destroy crop residue and stalks after the final picking; avoid ratooning.',
      IPM_NOTE,
    ],
  },
  {
    id: 'cotton-sucking-pests',
    name: 'Cotton sucking pests (jassid, aphid, whitefly, thrips)',
    scientific: 'Amrasca biguttula, Aphis gossypii, Bemisia tabaci',
    local: 'तुडतुडे',
    kind: 'insect',
    crops: { Cotton: [0.03, 0.6] },
    temp: { min: 18, optLow: 25, optHigh: 32, max: 38 },
    mode: 'dry',
    stressBoost: 0.5,
    symptoms:
      'Leaf edges curling and reddening (jassid), sticky honeydew (aphid, whitefly), silvery leaf patches (thrips).',
    scouting:
      'Count jassids and whiteflies on 3 leaves per plant from 20 plants. Use yellow sticky traps.',
    management: [
      'Avoid excess nitrogen and keep plants well watered, because stressed plants are more attractive.',
      'Conserve natural enemies; use neem-based products early.',
      IPM_NOTE,
    ],
  },
  {
    id: 'cotton-bacterial-blight',
    name: 'Cotton bacterial blight',
    scientific: 'Xanthomonas citri pv. malvacearum',
    kind: 'bacterial',
    crops: { Cotton: [0.1, 0.7] },
    temp: { min: 20, optLow: 26, optHigh: 32, max: 38 },
    humidity: { min: 70, full: 90 },
    mode: 'wet',
    symptoms: 'Angular, water-soaked leaf spots bounded by veins; black arm on stems; boll rot.',
    scouting: 'Check after rain with wind; look for angular leaf spots and boll lesions.',
    management: [
      'Use delinted, treated seed and resistant varieties.',
      'Avoid working in wet fields and remove infected residue.',
      IPM_NOTE,
    ],
  },

  /* ---------------- Tur (pigeonpea) ---------------- */
  {
    id: 'tur-pod-borer',
    name: 'Pod borer (Helicoverpa)',
    scientific: 'Helicoverpa armigera',
    local: 'घाटेअळी',
    kind: 'insect',
    crops: { Tur: [0.4, 0.85] },
    temp: { min: 15, optLow: 25, optHigh: 32, max: 38 },
    mode: 'neutral',
    symptoms:
      'Larvae feeding on buds, flowers and developing pods; round holes in pods, grain eaten.',
    scouting: 'Pheromone traps from flowering; count larvae on 20 plants and inspect pods.',
    management: [
      'Grow intercrops and trap crops; install bird perches to attract predatory birds.',
      'HaNPV or neem seed kernel extract on young larvae.',
      IPM_NOTE,
    ],
  },
  {
    id: 'tur-fusarium-wilt',
    name: 'Tur wilt',
    scientific: 'Fusarium udum',
    local: 'मर',
    kind: 'fungal',
    crops: { Tur: [0.1, 0.9] },
    temp: { min: 18, optLow: 25, optHigh: 30, max: 36 },
    mode: 'neutral',
    stressBoost: 0.5,
    symptoms:
      'Sudden yellowing and wilting of plants, often in patches; brown to purple streaks in the stem and blackened roots when split.',
    scouting:
      'Walk the field at flowering; split stems of wilting plants to check for dark vascular streaks.',
    management: [
      'Use wilt-resistant varieties, the single most effective measure.',
      'Treat seed with Trichoderma or a recommended fungicide; rotate with cereals such as sorghum.',
      'Avoid replanting tur in the same field year after year.',
    ],
  },
  {
    id: 'tur-phytophthora-blight',
    name: 'Tur Phytophthora blight',
    scientific: 'Phytophthora cajani',
    kind: 'fungal',
    crops: { Tur: [0.03, 0.5] },
    temp: { min: 20, optLow: 25, optHigh: 30, max: 35 },
    humidity: { min: 80, full: 95 },
    mode: 'wet',
    waterlogging: true,
    symptoms:
      'Water-soaked lesions on stems and branches; plants collapse in poorly drained patches after heavy rain.',
    scouting: 'Inspect low-lying, waterlogged patches after heavy rain.',
    management: [
      'Grow on ridges or raised beds and improve field drainage.',
      'Use tolerant varieties and treat seed with a recommended fungicide.',
    ],
  },

  /* ---------------- Jowar (sorghum) ---------------- */
  {
    id: 'jowar-shoot-fly',
    name: 'Sorghum shoot fly',
    scientific: 'Atherigona soccata',
    local: 'खोड माशी',
    kind: 'insect',
    crops: { Jowar: [0.02, 0.25] },
    temp: { min: 18, optLow: 22, optHigh: 30, max: 35 },
    humidity: { min: 60, full: 80 },
    mode: 'wet',
    symptoms: 'Central shoot dries (dead heart) in seedlings; side tillers may follow.',
    scouting: 'Count dead hearts in 10 spots at 2–4 weeks after emergence.',
    management: [
      'Sow early with the onset of rains; late sowing greatly raises damage.',
      'Use a higher seed rate and thin later; use tolerant varieties.',
      IPM_NOTE,
    ],
  },
  {
    id: 'jowar-grain-mould',
    name: 'Sorghum grain mould',
    scientific: 'Fusarium, Curvularia and other fungi',
    kind: 'fungal',
    crops: { Jowar: [0.5, 0.95] },
    temp: { min: 18, optLow: 25, optHigh: 30, max: 35 },
    humidity: { min: 80, full: 92 },
    mode: 'wet',
    symptoms: 'Pink, grey or black discolouration of grain in the ear head; light, soft grain.',
    scouting: 'Check ear heads after rain during flowering and grain filling.',
    management: [
      'Choose early or medium varieties so grain filling avoids the rainy period.',
      'Use varieties with open or compact heads recommended for your area; harvest at maturity and dry grain well.',
    ],
  },
  {
    id: 'jowar-charcoal-rot',
    name: 'Sorghum charcoal rot',
    scientific: 'Macrophomina phaseolina',
    kind: 'fungal',
    crops: { Jowar: [0.45, 0.95] },
    temp: { min: 26, optLow: 30, optHigh: 38, max: 42 },
    mode: 'dry',
    stressBoost: 1.0,
    symptoms: 'Plants lodge before maturity; split stalks show shredded pith with black specks.',
    scouting: 'Push stalks at grain filling; split lodged stalks and look for black specks.',
    management: [
      'Avoid moisture stress at grain filling; conserve soil moisture, especially in rabi sorghum.',
      'Moderate plant density and nitrogen; use tolerant varieties; rotate crops.',
    ],
  },

  /* ---------------- Bajra (pearl millet) ---------------- */
  {
    id: 'bajra-downy-mildew',
    name: 'Pearl millet downy mildew',
    scientific: 'Sclerospora graminicola',
    local: 'केवडा',
    kind: 'fungal',
    crops: { Bajra: [0.02, 0.35] },
    temp: { min: 15, optLow: 20, optHigh: 26, max: 32 },
    humidity: { min: 80, full: 95 },
    mode: 'wet',
    symptoms:
      'Pale, yellow streaks on leaves with white downy growth underneath in humid air; ear heads become leafy.',
    scouting:
      'Check seedlings at 2–5 weeks; uproot affected plants before white growth turns to spores.',
    management: [
      'Use resistant hybrids and treat seed with a recommended fungicide.',
      'Uproot and bury affected seedlings early; rotate crops.',
    ],
  },
  {
    id: 'bajra-ergot',
    name: 'Pearl millet ergot',
    scientific: 'Claviceps fusiformis',
    local: 'अरगट',
    kind: 'fungal',
    crops: { Bajra: [0.5, 0.75] },
    temp: { min: 15, optLow: 20, optHigh: 28, max: 32 },
    humidity: { min: 80, full: 95 },
    mode: 'wet',
    symptoms:
      'Sticky honeydew droplets on ear heads, later dark hard sclerotia replacing grain. Toxic if eaten.',
    scouting: 'Look for honeydew on ear heads during flowering in cool, humid, cloudy weather.',
    management: [
      'Sow on time so flowering avoids prolonged cool, humid weather.',
      'Use tolerant hybrids and treat seed by salt flotation to remove ergot bodies.',
    ],
  },

  {
    id: 'bajra-stem-borer',
    name: 'Pearl millet stem borer',
    scientific: 'Chilo partellus',
    kind: 'insect',
    crops: { Bajra: [0.05, 0.5] },
    temp: { min: 18, optLow: 25, optHigh: 30, max: 36 },
    mode: 'neutral',
    symptoms: 'Pin-hole damage on leaves, dead heart in young plants and tunnelling inside stems.',
    scouting:
      'Count plants with shot-hole damage or dead heart in 10 spots, 2–5 weeks after emergence.',
    management: [
      'Sow on time, remove and destroy stubble after harvest.',
      'Release Trichogramma egg parasitoids where recommended.',
      IPM_NOTE,
    ],
  },
  {
    id: 'bajra-earhead-caterpillar',
    name: 'Pearl millet earhead caterpillars',
    scientific: 'Helicoverpa armigera, Eublemma spp.',
    local: 'घाटेअळी',
    kind: 'insect',
    crops: { Bajra: [0.5, 0.85] },
    temp: { min: 18, optLow: 25, optHigh: 32, max: 38 },
    mode: 'neutral',
    symptoms: 'Caterpillars and webbing on the ear head; grain eaten and ears look ragged.',
    scouting: 'Inspect 20 ear heads at flowering and early grain fill for caterpillars and frass.',
    management: [
      'Sow in a tight window so ear heads in the area emerge together.',
      'Encourage birds and natural enemies; hand-pick on small plots.',
      IPM_NOTE,
    ],
  },

  /* ---------------- Gram (chickpea) ---------------- */
  {
    id: 'gram-pod-borer',
    name: 'Gram pod borer',
    scientific: 'Helicoverpa armigera',
    local: 'घाटेअळी',
    kind: 'insect',
    crops: { Gram: [0.35, 0.9] },
    temp: { min: 12, optLow: 22, optHigh: 30, max: 36 },
    mode: 'neutral',
    symptoms: 'Larvae feed on leaves, then bore holes in pods and eat developing grains.',
    scouting: 'Pheromone traps from flowering; count larvae on 20 plants.',
    management: [
      'Install bird perches and pheromone traps; use intercrops such as coriander.',
      'HaNPV on young larvae; hand-pick where infestation is light.',
      IPM_NOTE,
    ],
  },
  {
    id: 'gram-fusarium-wilt',
    name: 'Chickpea wilt',
    scientific: 'Fusarium oxysporum f. sp. ciceris',
    local: 'मर',
    kind: 'fungal',
    crops: { Gram: [0.05, 0.7] },
    temp: { min: 15, optLow: 22, optHigh: 30, max: 35 },
    mode: 'neutral',
    stressBoost: 0.4,
    symptoms:
      'Drooping and yellowing of seedlings or plants in patches; vascular tissue turns dark when the stem is split.',
    scouting: 'Look in patches at seedling stage and flowering; split stems of wilting plants.',
    management: [
      'Use wilt-resistant varieties, the most reliable control.',
      'Treat seed with Trichoderma or a recommended fungicide; rotate with cereals.',
      'Avoid sowing too early into warm soil.',
    ],
  },
  {
    id: 'gram-dry-root-rot',
    name: 'Chickpea dry root rot',
    scientific: 'Rhizoctonia bataticola (Macrophomina phaseolina)',
    kind: 'fungal',
    crops: { Gram: [0.35, 0.9] },
    temp: { min: 26, optLow: 30, optHigh: 38, max: 42 },
    mode: 'dry',
    stressBoost: 1.0,
    symptoms: 'Plants dry up suddenly at pod stage; tap root is brittle with tiny black sclerotia.',
    scouting:
      'Look for straw-coloured drying plants at flowering to podding and pull a few to check the roots.',
    management: [
      'Avoid late-season moisture stress and high temperature by sowing at the recommended time.',
      'Treat seed with Trichoderma or a recommended fungicide; rotate crops.',
    ],
  },

  /* ---------------- Rice ---------------- */
  {
    id: 'rice-blast',
    name: 'Rice blast',
    scientific: 'Magnaporthe oryzae',
    local: 'करपा',
    kind: 'fungal',
    crops: { Rice: [0.05, 0.75] },
    temp: { min: 15, optLow: 22, optHigh: 28, max: 32 },
    humidity: { min: 85, full: 95 },
    mode: 'wet',
    symptoms:
      'Diamond-shaped grey-centred leaf spots; neck of the panicle turns dark and breaks (neck blast).',
    scouting:
      'Check nursery and tillering fields in cool, cloudy, humid weather; check panicle necks at heading.',
    management: [
      'Use resistant varieties and treat seed.',
      'Split nitrogen into smaller doses; excess nitrogen makes plants more susceptible.',
      'Avoid dense planting and keep bunds free of grass weeds.',
      IPM_NOTE,
    ],
  },
  {
    id: 'rice-bacterial-blight',
    name: 'Rice bacterial leaf blight',
    scientific: 'Xanthomonas oryzae pv. oryzae',
    kind: 'bacterial',
    crops: { Rice: [0.15, 0.75] },
    temp: { min: 20, optLow: 26, optHigh: 32, max: 36 },
    humidity: { min: 70, full: 90 },
    mode: 'wet',
    symptoms:
      'Yellow to straw-coloured stripes along leaf edges that dry out; bacterial ooze in the morning.',
    scouting: 'Check fields after heavy rain and wind; look for wavy yellow leaf margins.',
    management: [
      'Use resistant varieties and healthy seed.',
      'Drain affected fields temporarily and avoid excess nitrogen.',
      'Avoid flooding fields from infected neighbouring plots.',
    ],
  },
  {
    id: 'rice-planthopper',
    name: 'Brown planthopper',
    scientific: 'Nilaparvata lugens',
    local: 'तुडतुडे',
    kind: 'insect',
    crops: { Rice: [0.3, 0.85] },
    temp: { min: 18, optLow: 25, optHigh: 30, max: 34 },
    humidity: { min: 70, full: 85 },
    mode: 'wet',
    symptoms:
      'Circular patches of yellowing then drying plants (hopper burn), insects clustered at the base of tillers.',
    scouting: 'Tap tillers over a tray or board; count hoppers per hill at the base of plants.',
    management: [
      'Avoid excess nitrogen and very close planting; leave wider alleys every few metres.',
      'Drain the field briefly if hoppers build up; avoid early broad-spectrum sprays that kill spiders and mirid bugs.',
      IPM_NOTE,
    ],
  },
  {
    id: 'rice-stem-borer',
    name: 'Yellow stem borer',
    scientific: 'Scirpophaga incertulas',
    local: 'खोडकिडा',
    kind: 'insect',
    crops: { Rice: [0.1, 0.7] },
    temp: { min: 18, optLow: 25, optHigh: 30, max: 34 },
    mode: 'neutral',
    symptoms: 'Dead hearts in the vegetative stage and white ear heads at flowering.',
    scouting: 'Count dead hearts and egg masses on leaf tips; use pheromone traps.',
    management: [
      'Clip seedling tips at transplanting to remove egg masses.',
      'Release Trichogramma egg parasitoids where recommended; destroy stubble.',
      IPM_NOTE,
    ],
  },

  /* ---------------- Groundnut ---------------- */
  {
    id: 'groundnut-leaf-spot',
    name: 'Groundnut early and late leaf spot (tikka)',
    scientific: 'Cercospora arachidicola, Nothopassalora personata',
    local: 'टिक्का',
    kind: 'fungal',
    crops: { Groundnut: [0.2, 0.95] },
    temp: { min: 18, optLow: 25, optHigh: 30, max: 34 },
    humidity: { min: 80, full: 92 },
    mode: 'wet',
    symptoms: 'Brown to black round spots with yellow halos on leaves, defoliation, weak pegs.',
    scouting: 'Check 20 plants for spots per leaf; start at 3–4 weeks after sowing.',
    management: [
      'Use tolerant varieties and rotate with cereals.',
      'Destroy residue and volunteer groundnut; avoid very dense stands.',
      IPM_NOTE,
    ],
  },
  {
    id: 'groundnut-rust',
    name: 'Groundnut rust',
    scientific: 'Puccinia arachidis',
    local: 'तांबेरा',
    kind: 'fungal',
    crops: { Groundnut: [0.3, 0.95] },
    temp: { min: 18, optLow: 22, optHigh: 28, max: 32 },
    humidity: { min: 80, full: 92 },
    mode: 'wet',
    symptoms:
      'Small orange pustules mostly on the underside of leaves that burst to release rusty powder.',
    scouting: 'Check the underside of leaves; spreads quickly in cloudy, humid weather.',
    management: ['Use tolerant varieties and remove volunteer plants.', IPM_NOTE],
  },
  {
    id: 'groundnut-spodoptera',
    name: 'Tobacco caterpillar',
    scientific: 'Spodoptera litura',
    kind: 'insect',
    crops: { Groundnut: [0.05, 0.7] },
    temp: { min: 18, optLow: 25, optHigh: 32, max: 38 },
    mode: 'dry',
    symptoms: 'Egg masses covered in brown hairs on leaves, larvae skeletonise leaves at night.',
    scouting: 'Use pheromone traps; inspect plants for egg masses and young larvae in the evening.',
    management: [
      'Collect and destroy egg masses and young larval clusters by hand.',
      'Grow castor as a trap crop on borders; use SlNPV or neem-based products on young larvae.',
      IPM_NOTE,
    ],
  },
  {
    id: 'groundnut-aflatoxin',
    name: 'Groundnut aflatoxin (Aspergillus flavus) risk',
    scientific: 'Aspergillus flavus',
    kind: 'fungal',
    crops: { Groundnut: [0.55, 1] },
    temp: { min: 22, optLow: 28, optHigh: 33, max: 40 },
    mode: 'dry',
    stressBoost: 1.2,
    symptoms:
      'Often invisible; mouldy, shrivelled or yellow-green seed and pod damage. Toxic to people and livestock.',
    scouting:
      'Avoid pod damage at harvest; separate shrivelled or mouldy pods before drying and storage.',
    management: [
      'Avoid drought stress during pod filling by timing irrigation at pegging and pod development.',
      'Harvest at maturity, dry pods quickly to safe moisture, store dry and off the ground.',
      'Control soil insects and avoid damaging pods during weeding and harvest.',
    ],
  },

  /* ---------------- Sugarcane ---------------- */
  {
    id: 'sugarcane-early-shoot-borer',
    name: 'Sugarcane early shoot borer',
    scientific: 'Chilo infuscatellus',
    kind: 'insect',
    crops: { Sugarcane: [0, 0.15] },
    temp: { min: 20, optLow: 28, optHigh: 36, max: 42 },
    mode: 'dry',
    symptoms: 'Dead hearts in young shoots that pull out easily and smell bad; reduced tillers.',
    scouting: 'Count dead hearts per 100 shoots in the first 4 months.',
    management: [
      'Plant healthy setts, earth up at the right time and irrigate to avoid hot, dry stress.',
      'Remove and destroy dead hearts; release Trichogramma where recommended.',
    ],
  },
  {
    id: 'sugarcane-woolly-aphid',
    name: 'Sugarcane woolly aphid',
    scientific: 'Ceratovacuna lanigera',
    local: 'लोकरी मावा',
    kind: 'insect',
    crops: { Sugarcane: [0.15, 0.8] },
    temp: { min: 18, optLow: 22, optHigh: 30, max: 35 },
    humidity: { min: 70, full: 90 },
    mode: 'wet',
    symptoms:
      'White, cottony colonies on the underside of leaves, sooty mould, yellowing and drying of leaves.',
    scouting:
      'Check the underside of leaves at 10 spots; look for predators such as Dipha and Micromus.',
    management: [
      'Conserve natural predators (Dipha aphidivora, Micromus, syrphid flies); avoid indiscriminate sprays.',
      'Avoid excess nitrogen and remove heavily infested leaves from small patches.',
      IPM_NOTE,
    ],
  },
  {
    id: 'sugarcane-red-rot',
    name: 'Sugarcane red rot',
    scientific: 'Colletotrichum falcatum',
    kind: 'fungal',
    crops: { Sugarcane: [0.1, 0.9] },
    temp: { min: 20, optLow: 26, optHigh: 32, max: 36 },
    humidity: { min: 80, full: 95 },
    mode: 'wet',
    waterlogging: true,
    symptoms:
      'Leaf midribs show red patches, tops dry; split canes show red tissue with white cross-bands and an alcoholic smell.',
    scouting: 'Split suspect canes lengthwise; look in waterlogged patches after heavy rain.',
    management: [
      'Plant disease-free setts of resistant varieties; treat setts before planting.',
      'Improve drainage; rogue out infected clumps and avoid ratooning infected fields.',
      'Rotate with a non-host crop.',
    ],
  },
];

export const threatsForCrop = (crop?: string) => THREATS.filter((t) => crop && crop in t.crops);

/* ---------------------------- Risk model ---------------------------- */

export type ThreatDay = {
  date: string;
  temperature: number;
  rain: number;
  humidity: number;
  /** true when this day's weather was carried forward rather than observed */
  carried: boolean;
  /** crop development as a fraction of maturity GDD */
  progress: number;
  /** modelled water stress, 0–1 */
  stress: number;
  /** water above field capacity, 0 (at or below) to 1 (saturated) */
  saturation: number;
};

export type ThreatAssessment = {
  threatId: string;
  score: number;
  level: RiskLevel;
  status: 'assessed' | 'outside-stage' | 'insufficient-weather';
  drivers: string[];
  daysUsed: number;
  carriedDays: number;
  /** susceptible stage range for this crop, in the crop's own stage names */
  window: string;
  /** recent daily scores, oldest first, for a small trend display */
  trend: number[];
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo));
const trapezoid = (v: number, t: Threat['temp']) =>
  v <= t.min || v >= t.max
    ? 0
    : v < t.optLow
      ? (v - t.min) / (t.optLow - t.min)
      : v <= t.optHigh
        ? 1
        : (t.max - v) / (t.max - t.optHigh);

export const riskLevel = (score: number): RiskLevel =>
  score < 25 ? 'Low' : score < 50 ? 'Moderate' : score < 70 ? 'High' : 'Very high';

function dayFavourability(th: Threat, d: ThreatDay, prev?: ThreatDay) {
  const temperature = trapezoid(d.temperature, th.temp);
  const rainRecent = Math.max(d.rain, prev?.rain ?? 0);
  const wet = rainRecent >= 2 ? 1 : rainRecent >= 0.2 ? 0.6 : 0;
  if (th.mode === 'wet') {
    const humidity = th.humidity ? ramp(d.humidity, th.humidity.min, th.humidity.full) : 0;
    return temperature * (th.humidity ? 0.65 * humidity + 0.35 * wet : 0.35 + 0.65 * wet);
  }
  if (th.mode === 'dry') {
    const dryness = 1 - ramp(d.humidity, 55, 85);
    return temperature * (0.5 + 0.5 * dryness) * (wet === 1 ? 0.7 : 1);
  }
  return temperature;
}

/**
 * Weather shows whether conditions suit a pathogen (infection needs warmth, humidity and wetness), but
 * it cannot show how many insects are actually present. Population-driven threats are therefore
 * capped so weather alone cannot read "Very high": temperature-only insects stay at most Moderate and
 * insects with a humidity or rain link at most High. Reaching the top needs scouting or trap counts.
 */
export const populationDriven = (th: Threat) => th.kind === 'insect' || !!th.vectorBorne;
const weatherCeiling = (th: Threat) =>
  !populationDriven(th) ? 1 : th.mode === 'neutral' ? 0.45 : 0.65;

function stageSusceptibility(progress: number, [from, to]: [number, number]) {
  return Math.min(ramp(progress, from - 0.05, from), 1 - ramp(progress, to, to + 0.05));
}

/** Score using the last ≤7 days ending at index `end` (inclusive). */
function scoreAt(th: Threat, days: ThreatDay[], end: number, window: [number, number]) {
  const start = Math.max(0, end - 6),
    slice = days.slice(start, end + 1),
    last = days[end];
  let weighted = 0,
    weights = 0;
  for (let j = start; j <= end; j++) {
    const w = j - start + 1;
    weighted += w * dayFavourability(th, days[j], j > 0 ? days[j - 1] : undefined);
    weights += w;
  }
  // Stress and waterlogging raise risk, but are normalised so ideal weather alone can never reach
  // 100 for threats that also depend on them: the top of the scale needs the extra condition too.
  const base = weights ? weighted / weights : 0,
    stage = stageSusceptibility(last.progress, window),
    maxAmplifier = (1 + (th.stressBoost || 0)) * (th.waterlogging ? 1.4 : 1),
    amplifier =
      ((1 + (th.stressBoost || 0) * last.stress) *
        (th.waterlogging ? 1 + 0.4 * last.saturation : 1)) /
      maxAmplifier;
  return {
    base,
    stage,
    score: Math.round(clamp(base * stage * amplifier * weatherCeiling(th)) * 100),
    slice,
    last,
  };
}

/**
 * Assess one threat for one plot.
 * `days` must be chronological daily records (most recent last).
 */
export function assessThreat(th: Threat, crop: CropName, days: ThreatDay[]): ThreatAssessment {
  const window = th.crops[crop];
  if (!window) throw new Error(`${th.id} does not apply to ${crop}`);
  const cfg = CROPS[crop],
    windowLabel = `${cropStage(cfg, Math.max(0, window[0]) * cfg.maturityGdd + 1)} → ${cropStage(cfg, window[1] * cfg.maturityGdd)}`;
  const empty = {
    threatId: th.id,
    score: 0,
    level: 'Low' as RiskLevel,
    drivers: [] as string[],
    daysUsed: 0,
    carriedDays: 0,
    window: windowLabel,
    trend: [] as number[],
  };
  if (!days.length) return { ...empty, status: 'insufficient-weather' };
  const end = days.length - 1,
    now = scoreAt(th, days, end, window),
    carriedDays = now.slice.filter((d) => d.carried).length;
  const trend: number[] = [];
  for (let i = Math.max(0, end - 6); i <= end; i++) trend.push(scoreAt(th, days, i, window).score);
  if (now.stage <= 0)
    return {
      ...empty,
      status: 'outside-stage',
      daysUsed: now.slice.length,
      carriedDays,
      trend,
      drivers: [
        now.last.progress < window[0]
          ? 'The crop has not yet reached the stage this threat attacks.'
          : 'The crop has passed the stage this threat attacks.',
      ],
    };
  const mean = (f: (d: ThreatDay) => number) =>
    now.slice.reduce((s, d) => s + f(d), 0) / now.slice.length;
  const meanT = mean((d) => d.temperature),
    meanH = mean((d) => d.humidity),
    rainDays = now.slice.filter((d) => d.rain >= 2).length;
  const drivers: string[] = [];
  const inRange = trapezoid(meanT, th.temp) >= 0.67;
  drivers.push(
    inRange
      ? `Average temperature ${meanT.toFixed(0)}°C is in the favourable range (${th.temp.optLow}–${th.temp.optHigh}°C).`
      : `Average temperature ${meanT.toFixed(0)}°C is outside the best range for this threat (${th.temp.optLow}–${th.temp.optHigh}°C).`,
  );
  if (th.mode === 'wet') {
    if (th.humidity)
      drivers.push(
        meanH >= th.humidity.min
          ? `Humidity averaged ${meanH.toFixed(0)}% (it needs about ${th.humidity.min}% or more).`
          : `Humidity averaged ${meanH.toFixed(0)}%, below the ${th.humidity.min}% it needs.`,
      );
    drivers.push(
      rainDays
        ? `${rainDays} wet day${rainDays > 1 ? 's' : ''} (2 mm or more) in the last ${now.slice.length} days.`
        : 'No significant rain in the last few days.',
    );
  } else if (th.mode === 'dry') {
    drivers.push(
      meanH < 70
        ? `Humidity averaged ${meanH.toFixed(0)}%; warm, drier air favours this threat.`
        : `Humidity averaged ${meanH.toFixed(0)}%, which is higher than it prefers.`,
    );
  }
  if (th.stressBoost && now.last.stress > 0.25)
    drivers.push('Modelled water stress is raising susceptibility.');
  if (th.waterlogging && now.last.saturation > 0)
    drivers.push('The root zone is above field capacity, which raises the risk.');
  if (populationDriven(th))
    drivers.push(
      'Weather shows whether conditions suit this pest, not how many are present. Check traps or scout to confirm.',
    );
  if (carriedDays)
    drivers.push(
      `${carriedDays} of the last ${now.slice.length} weather days were carried forward, so confidence is lower.`,
    );
  return {
    threatId: th.id,
    score: now.score,
    level: riskLevel(now.score),
    status: now.slice.length < 3 ? 'insufficient-weather' : 'assessed',
    drivers,
    daysUsed: now.slice.length,
    carriedDays,
    window: windowLabel,
    trend,
  };
}

export type PlotThreatReport = {
  plotId: string;
  plotName: string;
  crop: CropName;
  /** date of the latest weather day used, or null when none is available */
  asOf: string | null;
  weatherDays: number;
  assessments: ThreatAssessment[];
};

export const RISK_ADVICE: Record<RiskLevel, string> = {
  Low: 'No special action. Keep routine weekly scouting.',
  Moderate: 'Scout the field in the next 2–3 days and check traps or lower leaves.',
  High: 'Scout now. Prepare to act if counts reach the local threshold and carry out the cultural steps listed.',
  'Very high':
    'Scout today and again in 2–3 days. Confirm with your local agriculture officer or KVK before treating.',
};

export function assessPlotThreats(crop: CropName, days: ThreatDay[]): ThreatAssessment[] {
  return threatsForCrop(crop)
    .map((th) => assessThreat(th, crop, days))
    .sort((a, b) => b.score - a.score);
}
