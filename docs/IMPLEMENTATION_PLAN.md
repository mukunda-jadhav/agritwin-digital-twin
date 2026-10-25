# Incremental implementation and verification

> Historical planning record. Some original plans below (including synthetic weather and optional ML) were superseded. Current behavior and verified status are documented in README.md, MODELING.md and VERIFICATION.md.

## Phase 1: Foundation

Create npm workspaces, React/Vite/TypeScript and Express/TypeScript apps, shared contracts, environment validation, Prisma schema, SQL migrations, and seed scripts. Implement secure cookie registration/login/logout, protected routes, farm/plot CRUD, and owner-scoped queries. Add PostgreSQL development setup and Neon instructions.

Gate: install from lockfile, type-check, production builds, migrations against a clean development database, auth integration checks, and cross-user access denial including nested resource IDs. Record actual commands and results.

## Phase 2: 3D farm

Implement responsive shell, accessible controls, farm creation, terrain, instanced tomato plants, soil colors, irrigation geometry, orbit controls, and plot selection. Link all geometry and status to typed plot state. Add reduced-detail and WebGL failure handling.

Gate: frontend component checks, selection/state mapping, keyboard-accessible alternatives, resize checks, and measured representative rendering performance without fabricated FPS claims.

## Phase 3: Simulation

Implement pure daily water balance, versioned crop parameters, GDD stages, stress, growth, yield baseline, virtual clock, transactional snapshots, outbox, Socket.IO authorization, reset, and replay.

Gate: conservation, bounds, dry/rainy extremes, deterministic replay, duplicate command safety, simultaneous mutation handling, worker restart, and socket reconnect synchronization tests.

## Phase 4: Weather

Implement Open-Meteo forecast/history adapters, cache, stored inputs, source labels, synthetic seeded weather, and offline fallback. Verify provider fields and model parameters against current primary documentation.

Gate: fixture-based adapter checks, unit conversions, timeouts and incomplete data, forecast horizon transitions, and reproduction using saved inputs. Keep live-network checks separate from deterministic tests.

## Phase 5: AI and ML

Implement labeled irrigation, stress, and yield baselines. Add reproducible dataset preparation and TensorFlow.js training/evaluation/persistence commands. Use trajectory-level held-out splits and evaluate separately from training. Explain any synthetic-data limitation directly in the UI and dataset documentation.

Gate: artifact round-trip inference, feature schema compatibility, data split isolation, recorded real evaluation output, and explicit baseline fallback.

## Phase 6: Advanced workflows

Add irrigation schedules/history, immutable scenario branches, paired weather inputs, comparison charts, historical analytics, snapshot replay, insights, and settings.

Gate: verify scenario source isolation, equal starting conditions, correct unit conversions and cumulative water use, scheduling exactly once, and aligned chart dates.

## Phase 7: Delivery

Finish landing/auth pages, API documentation, deployment configurations, accessibility/error handling, realistic clearly labeled seed data, and an end-to-end demonstration. Document exact setup/run/build/test commands after the scripts exist. Supply an environment example with no secrets.

Gate: full production builds, meaningful unit/integration/component/end-to-end tests, access-control and cookie checks, deployment readiness, and a truthful verification report. A configured hosted database and deployment accounts are external prerequisites; a local build cannot prove hosted operation.

## External setup

A Neon PostgreSQL connection string is needed to verify against Neon. A local PostgreSQL instance can support development without cloud credentials. Vercel/Render deployment needs the user's hosting accounts and chosen domains. Do not invent credentials or claim remote deployment without evidence.

## Demonstration acceptance sequence

1. Register, create a farm and tomato plots, and open its interactive 3D view.
2. Load visibly labeled weather, start the clock, and observe calculated daily state changes.
3. Advance through insufficient rainfall, inspect water stress, and review baseline recommendations.
4. Apply measured irrigation and observe persisted storage and consumption updates across clients.
5. Branch an experiment with reduced irrigation using identical initial state and weather inputs.
6. Compare daily water, stress, growth, consumption, and estimated yield; verify the original run is intact.
7. Replay earlier snapshots and inspect irrigation history and source labels.

## Current delivery

The runnable website, backend simulation, persistence adapters, weather integration, TensorFlow.js surrogate, scenarios, tests, and deployment configurations have now been implemented. See README.md for setup and docs/VERIFICATION.md for actual results. Hosted deployment and Neon credentials remain external setup. This roadmap records the original plan; operational differences are documented in docs/API.md.

