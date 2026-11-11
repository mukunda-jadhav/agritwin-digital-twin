# Setup and current behavior

AgriTwin uses live Open-Meteo weather and keeps exact provider records with simulation runs. Open-Meteo does not require an API key. No Google Maps key is required; the farm-location picker uses OpenStreetMap.

## Local development

1. Install Node.js 22.12 or newer.
2. Copy .env.example to apps/api/.env and configure a random JWT_SECRET. Local development can use JSON persistence when DATABASE_URL is empty.
3. Run npm ci, npm run db:generate, then npm run dev.
4. Open http://localhost:5173.

Email/password sign-in works without Firebase. Google sign-in requires Firebase web configuration in apps/web/.env and Firebase Admin credentials in the API's private environment. Never put server credentials in VITE_ variables or commit environment files.

## PostgreSQL

Configure DATABASE_URL, WEB_ORIGIN and JWT_SECRET in apps/api/.env or the hosting provider's secret store. Set NODE_ENV=production to require PostgreSQL. Run npm run db:generate followed by npm run db:deploy before starting the API. The latest migration removes the obsolete dataMode field. JSON accounts are not imported automatically into PostgreSQL.

## Weather and simulation

Weather uses Open-Meteo daily forecast and historical reanalysis. The simulation saves provider observations used for initial soil-water setup and daily crop updates. Missing future weather reuses the latest provider values from the active run, archived runs or saved baseline scenarios. Reused weather is labeled with its original date; daily rainfall is set to zero to avoid repeating a previous event.

The crop catalog includes common Maharashtra crops plus tomato. Crop and soil parameters are reference assumptions, so growth, root-zone water, stress, recommendations and harvest remain model estimates until validated against farm measurements. No physical sensors or irrigation hardware are connected.



## November 2026 field workspace upgrade

- The default view now includes readable crop, water and stress summaries, a saved-day replay timeline, plot overlays, and an optional soil cross-section. Replay never advances the simulation.
- Procedural plants interpolate model snapshots with gradual leaf emergence, flowers, fruit ripening and stress colour/droop. Tomato, wheat and maize have distinct reproductive forms. These are illustrations, not measured plant geometry. Reduced-motion preferences skip interpolation.
- Scenario results include two views with linked cameras and a shared replay slider. Presets populate editable experiments; signed differences compare the displayed day, while the existing table remains the final state.
- Field observations are saved on the farm with run, snapshot and model version. Stage and cumulative harvest comparisons do not modify the model. Plant height is recorded without claiming the renderer is a validated height model.
- Download season report exports a standalone HTML file with graphs, daily estimates, provenance, inputs, watering and observations. Open it in a browser to print or save as PDF.

For an existing PostgreSQL installation, run `npm run db:deploy` before starting the upgraded API. Migration `202611110001_field_observations` adds a nullable JSONB field and preserves existing farms. File-based development storage requires no migration.

Verification: `npm test`, `npm run build`, and `npm run test:e2e`. Browser tests use isolated API fixtures and do not modify a real account. Windows uses installed Microsoft Edge; on other systems install Playwright Chromium for browser tests.
