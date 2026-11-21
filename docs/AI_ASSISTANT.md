# Ask AgriTwin

Open a farm's Overview and select **Ask about my crop**. The assistant uses the selected plot and the exact saved day being viewed, including historical replay. Suggested questions, plain-text answers, a source-details disclosure and the existing read-aloud control support English, Hindi and Marathi. Changing the plot, season or saved day clears the conversation so old answers are not presented as current advice.

## Enable connected AI

For local development, add these variables to `apps/api/.env` and restart `npm run dev`:

```dotenv
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-4.1-mini
```

Use `apps/api/.env.example` as a template without overwriting existing settings. In Render, add the variables to the API service's environment and redeploy/restart. Do not use a `VITE_` prefix for the key. API usage requires an OpenAI API account with available credits; a ChatGPT subscription does not configure this server.

Without a key, the panel explicitly says **Basic guide · AI not connected**. This mode displays deterministic saved water/stress explanations in the selected language. It does not interpret free-form questions or pretend to be an AI model. An invalid key or provider outage produces an error, not a silently substituted AI answer.

## Gemini (free-tier option)

Set `GEMINI_API_KEY` on the Render service and save/redeploy. The default `GEMINI_MODEL` is `gemini-2.5-flash-lite`. No browser key or Firebase key is used for AI.

Gemini is selected automatically when its key is present. Optionally set `AI_PROVIDER=gemini` or `AI_PROVIDER=openai` to explicitly select a provider. A missing key for the selected provider uses the basic guide. Provider errors never switch to another paid provider.

Free-tier availability and quotas are controlled by Google, not AgriTwin. Use a free-tier project for free usage; enabling billing can incur charges. Free-tier prompts and replies may be used to improve Google products, so use demo data. See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

## What it can do

- Explain saved crop stage, water balance, stress, estimated yield and numeric field observations.
- Answer follow-up questions using the last three exchanges in the current panel.
- Preview a watering/weather experiment for the selected plot using the existing simulation engine. Example: “Compare 25% less water for 14 days, using 15 mm every 2 days.”
- Show computed changes in applied water and estimated yield alongside the baseline policy and weather provenance. Previews are not saved and do not change irrigation schedules, snapshots or farms. The existing Scenario analysis page remains available to create saved comparisons.

The AI requests an explicit baseline amount and interval when they are missing. The tool validates limits (at most 30 days), fetches weather through the existing provider service and checks coverage. Missing weather or invalid arguments return a tool error, never fabricated numerical results. Forecast, reanalysis and carried-forward inputs remain distinguishable. These outcomes are educational estimates, not validated field forecasts.

## Privacy and limits

The backend sends the question, up to six short conversation messages, crop/soil/area/method, saved model state, weather and recent numeric observations to the selected AI provider (Google Gemini or OpenAI). It omits account identity, farm/plot names, coordinates, addresses, observation free text and credentials. Users should not put personal information in their questions. OpenAI responses are requested with `store: false`; Gemini uses stateless `generateContent` requests; this is not a promise of zero provider retention. Conversations are held in browser component memory, not saved to AgriTwin's database.

All farm routes require the existing session, ownership and Origin checks. AI requests are limited to 15 per user per 10 minutes, a 1,200-character question, six bounded history messages, at most two model calls and one scenario tool call. Provider calls have 25-second timeouts. Provider errors are not exposed to the browser. Model text renders as plain text, never HTML. The model has no browsing, image diagnosis, file access or mutation tools.

No microphone recording or photo-upload feature is included in this version. Read-aloud depends on browser voices. The model is instructed to explain uncertainty and avoid disease diagnoses and pesticide dosages; it can still make mistakes, so users must check the field before acting.

## Verification

`npm test` covers no-key behavior, privacy filtering, selected plot/date bounds, mocked connected responses, tool execution, non-mutation and failure handling. `npm run test:e2e` exercises the panel with mock API data alongside the existing 3D workspace. `npm run build` checks production compilation. These checks do not spend API credits or establish live model answer quality. Test a configured key separately before a live presentation.

Integration references: [OpenAI quickstart](https://developers.openai.com/api/docs/quickstart), [function calling](https://developers.openai.com/api/docs/guides/function-calling).
