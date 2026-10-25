# Credentials checklist

Before deployment, revoke and replace the Firebase Admin private key, Neon password and AGMARKNET key that were previously pasted into chat. The exposed Firebase private key has been cleared from the local API environment. Do not reuse it.

## Where to put them

- Server secrets: `apps/api/.env` (template: `apps/api/.env.example`).
- Public browser configuration: `apps/web/.env` (template: `apps/web/.env.example`).
- Do not post private keys, database passwords, service-account JSON or the mandi API key in chat. Populate the files locally and say which services are ready. Do not overwrite an existing JWT_SECRET.

| Service | Variables | Obtain from |
|---|---|---|
| Mandi prices | `AGMARKNET_API_KEY` | Your data.gov.in account API key |
| Firebase backend | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase project settings → service accounts → Admin SDK service-account JSON |
| Firebase browser | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Firebase project settings → your registered Web app → SDK configuration |
| Neon | `DATABASE_URL`, `DIRECT_URL` | Neon connection details: pooled and direct PostgreSQL connection strings |

Firebase browser configuration is intended for browser use; it is not an Admin credential. Enable Google sign-in and authorized domains in Firebase Authentication. Use the same Firebase project on server and browser.

For FIREBASE_PRIVATE_KEY, keep the entire PEM value in quotes on one line using literal `\n` between lines. Alternatively use GOOGLE_APPLICATION_CREDENTIALS pointing to the downloaded service-account JSON and set FIREBASE_PROJECT_ID.

Neon URLs contain passwords. Keep sslmode=require. Connecting an empty Neon database does not transfer existing local farm records; import planning is separate from entering credentials.

## No credentials needed

Open-Meteo weather for this noncommercial local project. Crop simulation, saved local farm records, email sign-in, and manually entered cost assumptions work without cloud keys. No chatbot/LLM key is required for the current scope.

## Activation

Restart the app after editing environment files. For a configured database, generate Prisma Client and deploy migrations before starting the API. External services are not considered operational merely because a key is present; authentication, provider responses and data freshness must also succeed.

## Free maps
Leaflet with OpenStreetMap is now the default. No Google Maps key, Map ID, or billing account is needed. Supports GPS, coordinates, boundary drawing, corner editing and approximate area. Standard tiles are not satellite imagery. Public tile service is best-effort and subject to https://operations.osmfoundation.org/policies/tiles/ . No bulk download or offline prefetch is implemented. Browser caching and visible attribution are retained. Optional VITE_MAP_TILE_URL and VITE_MAP_ATTRIBUTION allow another provider.

