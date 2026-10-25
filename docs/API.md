# API and synchronization

Base path: /api. OpenAPI 3.1: GET /api/openapi.json. API info: GET /api/docs.

Authentication uses an HTTP-only signed session cookie. Browser requests include credentials. State-changing requests must use the configured WEB_ORIGIN. Passwords are bcrypt hashed; logout revokes all sessions for the account. Production cookies are Secure. Google sign-in is optional.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Storage and model version |
| GET | /auth/providers | Available sign-in providers |
| POST | /auth/register | Create an email/password account |
| POST | /auth/login | Sign in |
| POST | /auth/firebase | Sign in with configured Firebase identity |
| POST | /auth/logout | Revoke sessions |
| GET | /auth/me | Current account |
| GET | /crops | Crop reference profiles and soil classes |
| GET/POST | /farms | List owned farms / create a farm |
| GET/PATCH/DELETE | /farms/:id | Read, update metadata, or delete a farm |
| POST | /farms/:id/plots | Add a plot before simulation |
| PATCH/DELETE | /farms/:id/plots/:plotId | Edit or remove a plot before simulation |
| POST | /farms/:id/initialize-soil | Estimate initial soil water |
| GET | /farms/:id/weather | Provider weather from the virtual date, with provenance |
| POST | /farms/:id/control | Start, pause, advance, reset, or change speed |
| POST | /farms/:id/irrigation | Apply virtual water or create a schedule |
| PATCH | /farms/:id/irrigation/:eventId | Enable or disable a schedule |
| POST | /farms/:id/harvest | Record a simulated harvest |
| GET | /farms/:id/predictions | Explainable irrigation and crop-state estimates |
| GET | /farms/:id/analytics | History, events and archived runs |
| POST | /farms/:id/scenarios | Compare two simulated management choices |

Nested farm routes check ownership. Invalid requests return 400 and an error message; missing or unowned farms return 404. Account limits: 20 farms, 24 plots per farm, 120 days per advance command, 730 days per run, 10 archived runs and 30 scenarios per farm.

Weather uses Open-Meteo forecast and historical reanalysis. Each consumed provider record is saved with the run. When requested weather is unavailable, the last provider record available to the active or archived runs is carried forward. Carried records retain the original source date and set daily rainfall to zero. Provider outages are tolerated when a saved weather record can be reused. If there is no real provider record to start from, the operation returns an error rather than inventing weather.

All API area values are m², temperature °C, water depth mm, applied volume litres, and simulated yield kg.

## Socket.IO

Connect using the session cookie and withCredentials. Send farm:join with an owned farm ID. Messages include farm:state-updated, simulation:started, simulation:paused, simulation:ticked, irrigation:applied, simulation:error and farm:deleted. The server checks ownership before joining a room. The browser fetches authoritative state after reconnect.

One API instance owns the simulation clock. Mutations are serialized; state is saved before broadcasts. Distributed worker coordination and an event outbox are not implemented. On restart, runs pause.

