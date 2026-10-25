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

