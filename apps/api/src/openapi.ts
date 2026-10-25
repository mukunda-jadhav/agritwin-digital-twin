import { CROP_NAMES } from '@agritwin/shared';

const text = { type: 'string' },
  number = { type: 'number' },
  integer = { type: 'integer' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const plot = object(
  {
    name: { ...text, minLength: 1, maxLength: 60 },
    area: { ...number, minimum: 10, maximum: 1000000 },
    soil: { enum: ['Loam', 'Sandy', 'Clay'] },
    method: { enum: ['Drip', 'Sprinkler', 'Flood'] },
    plantingDate: { type: 'string', format: 'date' },
    crop: { enum: CROP_NAMES },
  },
  ['name', 'area', 'soil', 'method', 'plantingDate'],
);
const farm = object(
  {
    name: text,
    location: text,
    latitude: { ...number, minimum: -90, maximum: 90 },
    longitude: { ...number, minimum: -180, maximum: 180 },
    area: { ...number, minimum: 10 },
    unit: { enum: ['m²', 'ha', 'acre'] },
    plots: { type: 'array', items: plot, minItems: 1, maxItems: 24 },
  },
  ['name', 'location', 'latitude', 'longitude', 'area', 'plots'],
);
const paths: Record<string, Record<string, unknown>> = {};
function route(path: string, method: string, summary: string, body?: unknown, auth = true) {
  const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: text,
  }));
  paths[path] ??= {};
  paths[path][method] = {
    summary,
    security: auth ? [{ session: [] }] : [],
    ...(params.length ? { parameters: params } : {}),
    ...(body
      ? { requestBody: { required: true, content: { 'application/json': { schema: body } } } }
      : {}),
    responses: {
      200: {
        description: 'Successful response',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      201: { description: 'Resource created' },
      400: { description: 'Validation failed' },
      401: { description: 'Session missing or expired' },
      403: { description: 'Origin not allowed' },
      404: { description: 'Not found or not owned by caller' },
      409: { description: 'Conflict' },
      429: { description: 'Rate limited' },
      500: { description: 'Operation failed' },
    },
  };
}
route('/health', 'get', 'Storage mode and process health', undefined, false);
route('/crops', 'get', 'Supported crops and soil parameters', undefined, false);
route(
  '/auth/register',
  'post',
  'Register and set HTTP-only session cookie',
  object({
    name: text,
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 10, maxLength: 128 },
  }),
  false,
);
route('/auth/login', 'post', 'Sign in', object({ email: text, password: text }), false);
route('/auth/logout', 'post', 'Revoke current session', object({}));
route('/auth/me', 'get', 'Current public account');
route('/farms', 'get', 'List farms owned by current user');
route('/farms', 'post', 'Create a farm; all stored areas use square metres', farm);
route('/farms/{id}', 'get', 'Farm, active run, snapshots, events, scenarios and archived runs');
route(
  '/farms/{id}',
  'patch',
  'Update farm metadata',
  object(
    {
      name: text,
      location: text,
      latitude: number,
      longitude: number,
      area: number,
      unit: { enum: ['m²', 'ha', 'acre'] },
    },
    [],
  ),
);
route('/farms/{id}', 'delete', 'Delete a farm and all related history');
route('/farms/{id}/plots', 'post', 'Add a plot before simulation begins', plot);
route('/farms/{id}/plots/{plotId}', 'patch', 'Update an unstarted plot', plot);
route('/farms/{id}/plots/{plotId}', 'delete', 'Delete an unstarted plot');
route(
  '/farms/{id}/weather',
  'get',
  'Sixteen daily inputs from virtual date with source provenance',
);
route(
  '/farms/{id}/control',
  'post',
  'Control the backend virtual clock',
  object(
    {
      action: { enum: ['start', 'pause', 'step', 'reset', 'speed'] },
      days: { ...integer, minimum: 1, maximum: 120, default: 1 },
      speed: { ...integer, minimum: 1, maximum: 10, default: 1 },
    },
    ['action'],
  ),
);
route(
  '/farms/{id}/irrigation',
  'post',
  'Apply water immediately or schedule by virtual date; id is an idempotency UUID',
  object(
    {
      id: { type: 'string', format: 'uuid' },
      plotId: text,
      amount: { ...number, minimum: 0.1, maximum: 100 },
      date: { type: 'string', format: 'date' },
      interval: { ...integer, minimum: 0, maximum: 30, default: 0 },
    },
    ['id', 'plotId', 'amount'],
  ),
);
route(
  '/farms/{id}/irrigation/{eventId}',
  'patch',
  'Enable or disable a schedule',
  object({ enabled: { type: 'boolean' } }),
);
route(
  '/farms/{id}/predictions',
  'get',
  'Crop water recommendations from the weather-driven soil-water model',
);
route('/farms/{id}/analytics', 'get', 'Complete snapshots, irrigation events and archives');
route(
  '/farms/{id}/scenarios',
  'post',
  'Run and save paired scenario branches',
  object({
    name: text,
    days: { ...integer, minimum: 1, maximum: 120 },
    rainMultiplier: { ...number, minimum: 0, maximum: 3 },
    temperatureDelta: { ...number, minimum: -10, maximum: 10 },
    irrigationMultiplier: { ...number, minimum: 0, maximum: 2 },
    interval: { ...integer, minimum: 1, maximum: 30 },
    amount: { ...number, minimum: 0, maximum: 80 },
  }),
);
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'AgriTwin API',
    version: '1.0.0',
    description:
      'Single-process authoritative digital farm simulation. Mutations require an Origin header matching WEB_ORIGIN. Area m², water mm, volume L, temperature °C. Errors return {error:string}. Farm resources are ownership scoped. All snapshots are immutable.',
  },
  servers: [{ url: '/api' }],
  components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'session' } } },
  paths,
};
