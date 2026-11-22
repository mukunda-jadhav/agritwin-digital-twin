# Farm diary, expenses and offline access

The Farm diary page records notes and expenses for the selected farm. Dates are real calendar dates, independent of the simulation clock. Expense amounts are stored as integer paise (INR) to avoid rounding drift. The total covers the visible date filter, including any pending drafts, and is recorded spending only: it does not modify the simulation or estimated-profit settings. CSV export includes the saved/pending status. Remove incorrect entries and add corrected ones.

## Offline use

While online, open **Offline access → Save farms offline** on a trusted device. This explicitly stores a copy of the signed-in user's farms in IndexedDB. The production service worker prepares versioned app files, including lazy-loaded pages. It never caches authenticated API responses or third-party tiles. Cached farm records are maintained by the application, scoped to an account. Signing out removes that account's offline copy and asks before discarding pending drafts. A session rejection locks offline access; another account cannot use the prior account's saved session.

Without internet, revisit `/app/diary` or the farm workspace. A banner labels saved data and its last-save time. Diary notes/expenses can be saved as pending drafts after offline access has been enabled. Other writes (simulation, irrigation, farm setup, settings, AI) require internet. No background synchronization is claimed: reconnect and choose **Sync entries** or **Refresh & sync**. Sync verifies the current account, sends stable entry IDs, and retains any unsuccessful drafts. Server validation, ownership checks and idempotency prevent duplicate expenses when a response is lost. Existing diary records can only be removed online; local pending drafts can be discarded offline.

Offline data is a convenience copy, not a backup. Browser/device storage may be removed or run out. Storage errors are displayed instead of reporting a successful draft save. Live weather, AI and map tiles remain online-only. Crop guide text works offline. Detailed model advice is available offline only if it was previously fetched. A newly deployed version needs an online visit before its files are available offline.

## Seasonal guidance

Crop advice includes three short Maharashtra-oriented cards: Kharif, Rabi and summer. They give typical sowing windows, examples and a water/soil checklist. They do not infer soil from coordinates or automatically change farm crops. District, variety, irrigation and monsoon timing require local KVK/agriculture-officer guidance.

References: [ICAR Maharashtra](https://www.icar.gov.in/index.php/en/node/17272), [Maharashtra agricultural seasons](https://www.gazetteers.maharashtra.gov.in/cultural.maharashtra.gov.in/english/gazetteer/aurangabad/CHAP04/AGRICULTURAL%20SEASONS.htm), [Maharashtra crop statistics by season](https://krishi.maharashtra.gov.in/Site/Upload/GR/STATE%20APY%20THIRD%20ADV%20%20EST%202025-26.pdf).

## Verification

- `npm test`: ownership, amount validation, duplicate retry, conflict handling, deletion and PostgreSQL diary persistence, alongside existing coverage.
- `npm run build`: creates the offline shell and checks both applications.
- `npx playwright test -c playwright.offline.config.ts`: tests production service-worker reload offline, draft persistence, failed/successful sync, mobile layout, seasonal guide and account isolation with test fixtures. No real farms or external AI calls are used.
- `npm run test:e2e`: existing workspace regression.

Render applies the additive nullable `Farm.diary` migration during its normal build. Existing farms need no conversion. Android packaging is not included.
