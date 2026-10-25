# AgriTwin — Maharashtra Farm Digital Twin

AgriTwin is a software-only agricultural digital twin for exploring how weather, crop stage, soil class and irrigation choices affect farms in Maharashtra. Farmers enter their own farm and plot details; the app uses provider weather and an agronomic water-balance and crop-growth model to update a virtual representation of the field. No physical sensors are required. Soil moisture, crop growth, stress and yield are model estimates, not direct measurements or guaranteed outcomes.

**GitHub description:** A software-only digital twin for Maharashtra farms. Simulate crop growth and root-zone water using farmer-entered field details, crop parameters and weather data, with a 3D field view, irrigation records and scenario analysis.

## Run locally

From PowerShell, run npm run dev in this folder and open http://localhost:5173. The web app uses port 5173 and the API uses port 4000. Node.js 22.12 or newer is required. Install dependencies with npm ci if this is a fresh checkout.

Create an account, add a farm, and add one or more plots. Choose a crop, planting date, soil class and irrigation method. Start the simulation or advance it by one day. The first advance estimates starting soil water from recent provider data when available and otherwise spins up the water balance from historical weather.

## What the model uses

Weather comes from Open-Meteo forecast and historical reanalysis. No weather API key is required. Actual provider days are saved with the run. If a later day has no new provider record, the most recent available weather is carried forward and shown as such in the field view. Daily rainfall is set to zero on carried days because repeating yesterday's rainfall would count the same event twice. If no provider weather has ever been received or saved for a run, the app cannot claim real weather for that date.

Supported crop profiles include wheat, maize, tomato, soybean, cotton, tur (pigeonpea), jowar, bajra, gram (chickpea), rice, groundnut and sugarcane. Crop profiles are reference assumptions. Weather is provider data; soil water, crop development, stress, irrigation recommendations and yield are model estimates. This is a research prototype and has not been validated against field sensors, measured irrigation or harvested yields.

The 3D view is a schematic representation of plots and crop development. Its camera stays in place while daily states update. A simulation pauses automatically at crop maturity and presents the harvest action.

## Production configuration

For Render, connect the repository as a Blueprint and use the included `render.yaml`. The web service builds the React frontend and API together, then serves both from one origin; this keeps API requests, sign-in cookies and live simulation sockets on the same host. In the Render environment, set `DATABASE_URL` to the Neon pooled connection string and `DIRECT_URL` to the Neon direct connection string. Render generates `JWT_SECRET`. The Blueprint runs database migrations before each deployment. Firebase web and Admin configuration enables Google sign-in; add the deployed hostname to Firebase Authentication's authorized domains. Set `AGMARKNET_API_KEY` to enable mandi prices. Do not commit `.env` files or put server credentials in frontend variables.

Google sign-in is optional; email/password sign-in is available. Google Maps is not required. Location setup uses the free OpenStreetMap-based picker. Do not place API keys, database passwords or service-account private keys in source files or public frontend variables. A local .env.example lists the names expected by the app.

The new migration removes the obsolete Farm dataMode column. Apply migrations before deploying the updated server. The app has not been deployed to a hosted environment, and its crop/yield parameters still need local agronomic validation before use in operational farm decisions.

## Main parts

- apps/web: React, TypeScript, Three.js and farm workspace UI.
- apps/api: Express API, authentication, simulation clock, weather provider and persistence.
- packages/shared: farm/crop contracts and lifecycle logic.
- docs: operating notes, model assumptions, API and teacher presentation guide.

