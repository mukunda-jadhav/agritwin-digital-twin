# Professional upgrade: inspection and repair plan

> Historical implementation plan from the initial visual upgrade. Crop coverage, map setup and weather behavior have since changed; refer to README.md and MODELING.md for the current application.

## Findings

The interface uses decorative farming slogans, a floating rectangular terrain block, repeated round plants, pale low-contrast labels, and a promotional illustration. Plot dimensions do not reflect area. Only tomato is configured. Authentication and location selection do not yet implement Firebase/Google Maps. The application has working ownership checks, persistence, simulation, irrigation, scenarios, and tests that should be retained.

## Ordered implementation

1. Preserve source and local data. Replace the visual system with charcoal navigation, white work surfaces, agricultural green, readable type, restrained borders, and consistent controls. Use a scientific field-study presentation on the landing page.
2. Replace the scene with grounded, textured field parcels scaled from area, instanced species-specific crop geometry, irrigation lines, selectable plot boundaries, and aerial/isometric/crop/inspection cameras. Label generated parcel arrangements as schematic rather than surveyed geometry.
3. Introduce versioned wheat, maize and tomato configurations with distinct GDD stages, Kc curves, temperature response, height/spacing, yield and harvest behavior. Preserve legacy simulations with their original model. Store repeated tomato harvest events explicitly.
4. Add English, Hindi and Marathi navigation, forms, key status summaries and recommendations, with an explicit language selector and optional native-language speech synthesis. Keep measured/simulated quantities and advanced details separate.
5. Build a guided farm setup flow with Google Places/Maps when configured, marker selection, editable polygon area, and manual coordinates/area fallback. Never infer soil or crop from map position.
6. Integrate Firebase Google sign-in and Admin token verification; bind UID to server-side users, require a signed-in legacy account before linking matching email, and preserve farm ownership. Keep existing access available during configuration.
7. Add non-destructive database migration, integration setup documentation, unit and browser regression tests, and visual checks at desktop/mobile sizes.

## External configuration

Firebase project credentials, enabled Google sign-in, Google Maps/Places API key, and Neon database credentials are not present in the supplied request. Implement integrations using environment variables and explicit unavailable states. Do not claim those external services have been activated or tested without credentials.

## Model evidence

Use FAO crop coefficient guidance for ET relationships. Crop thermal thresholds, varieties and yield limits remain declared reference assumptions until independently calibrated. Every rendered growth/stress change must come from saved model state. Satellite imagery must only be actual Google imagery when an API key is configured; the standalone 3D field is a simulated schematic.
