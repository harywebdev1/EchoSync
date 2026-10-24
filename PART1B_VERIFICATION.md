# EchoSync Phase 1 — Part 1B verification

Implemented on top of clean Part 1A commit `7a0b074`.

## Application verification

- Production build: PASS, entry JavaScript **441.95 KB** (139.75 KB gzip), below 500 KB; no build errors.
- `node integrity-unit.cjs`: **18/18 PASS**.
- `node api-verify.cjs`: **13/13 PASS**, including official search/details mapping, captured DES known-answer vector, normalized 320/160 URLs and 500px artwork, fixed-origin fallback, request validation, bounded failures, and Vercel rewrites.
- `node integrity-browser.cjs`: **15/15 PASS in development and production preview**. Duration gates, storage notices, real recording failures/retry, role restrictions, sync ownership, queue filters, sleep timer, mobile Back and root audio identity remain covered. Updated the role-display locator to the new room attribution; permission assertions are unchanged.
- `node phase8_1-verify.cjs`: **22/22 PASS in development and production preview**.
- `node part1b-verify.cjs`: **3/3 viewport scenarios PASS** in development and production preview (1366×768 synced lyrics, 1440×900 plain lyrics, 390×844 mobile). Production additionally verifies Room Chat menu bounds and outside dismissal at both desktop sizes.
- Production fixture regression: initial runs passed 6/7, with Queue-open long tasks of 974 ms and 805 ms exceeding the unchanged 750 ms budget. Traces showed layout/paint cost while the stage resized. Offscreen shelf deferral alone still measured 824 ms and was removed. Final layout/paint containment on the existing scrolling stage and Queue surfaces passed **7/7**, with **594 ms maximum** at 4× CPU (unchanged 750 ms limit). Earlier traces are retained in `regression/`, `regression-repeat/` and `regression-contained/`; final evidence is in `regression-final/`. Timing remains hardware/load dependent, so these measurements do not promise identical future runtimes.

The new UI checks assert one FullScreenPlayer Queue pill, Sleep Timer in the utility row, no poster quality overlay or bottom clipping on the required desktop sizes, sans-serif lyrics without source badges/timestamps, retained click-to-seek, a visible playlist header and disabled empty actions, spaced Find songs CTA, non-padded room counts, genuine empty-room state, both one-click and modal-selected starter playback, one Members & Roles control, no in-stage transport/seek controls, stable root audio, and non-overlapping message menus. No page errors were observed.

## External provider status

Live request against production preview `/api/saavn/api/search/songs?query=Atif%20Aslam&limit=5` returned **HTTP 200**, `X-EchoSync-Catalog: jiosaavn-direct`, with 10 official results (the upstream returned more than the requested limit), all with durations ≥60 seconds. Song details returned HTTP 200 with one song. Range probes of the first song's decrypted **320 kbps and 160 kbps** URLs each returned **HTTP 206**, `audio/mp4`, and 512 audio bytes. No HTTP 429 occurred in this probe.

This confirms catalog, details and media availability at verification time; it is not a guarantee against future upstream restrictions. No Vercel deployment was performed. API contract tests use controlled upstream responses and are reported separately from these live probes.

The shared handler now uses official JioSaavn first and only tries fixed wrapper mirrors after upstream failure. Existing development, preview and serverless entrypoints consume the same handler. Requests have an 8-second overall deadline, bounded response sizes, client-disconnect cancellation and validated routes/parameters. Decryption prefers native `des-ecb`; this Node/OpenSSL runtime omits it, so `des-ede3` with the same key repeated three times implements the identical DES-ECB operation without enabling a legacy provider. A captured ciphertext/plaintext test verifies compatibility.

## Fresh screenshot evidence

Screenshots use deterministic catalog/media/lyrics fixtures, rather than claiming live provider artwork. Production evidence is saved locally under `performance-results.local/part1b/production/` (ignored artifacts).

- [Full player — synced lyrics, 1366×768](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/full-player-synced-1366.png>)
- [Full player — plain lyrics, 1440×900](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/full-player-plain-1440.png>)
- [Full player — mobile](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/full-player-synced-390.png>)
- [Library playlist detail](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/playlist-1366.png>)
- [Empty Room stage](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/room-empty-1366.png>)
- [Active Room stage](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/room-active-1366.png>)
- [Rooms directory](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/rooms-1366.png>)
- [Public Lounge message menu](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/lounge-menu-1366.png>)
- [Room Chat message menu](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1b/production/room-chat-menu-1366.png>)

Raw build, unit/API, browser and live probe logs are in `performance-results.local/part1b/`.
