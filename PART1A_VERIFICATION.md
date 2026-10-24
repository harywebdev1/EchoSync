# EchoSync Phase 1 — Part 1A verification

Date: 2026-10-24. Starting state: clean `150f644`; Phase 8.1 was already committed.

## Delivered

- Live Home mood queries use rotating curated Saavn query pools and fresh search requests. Local ranking appears immediately; a small active-chip spinner indicates loading. Only the latest mood response publishes; unavailable live feeds retain the saved rotation with a visible notice. Fresh metadata merges onto existing song identities so likes/history survive and duplicate provider copies do not flood Quick Picks.
- Forced stream recovery bypasses resolved/search/detail caches. Successful seed-resolution promises are released, rejected preload promises can retry, local API authorization errors do not permanently poison the mirror list, and stale recovery cannot resume a different queue item or override sleep pause. An interrupted play probe gets one bounded retry before fresh-source recovery. Next two queue entries prewarm after validated media readiness.
- Shared `resolveTrackArtwork` and artwork-source normalization cover artwork/cover/image/thumbnail/albumArt. Cover retains the original valid image URL across sizes instead of inventing a thumbnail path; alternate sources and proxy URLs are tried before the monogram. Palette extraction reads proxy-backed canvas pixels, tries alternative artwork, and publishes accent/RGB/glow/surface variables with deterministic hue fallback. Registered glow/surface color properties interpolate over 600ms.
- Desktop stage content and Player Dock occupy separate flex zones. Queue count is an inline pill, metadata has a useful minimum width, and tablet drawers end above the dock. The sleep selector exists only in the expanded player. Root AudioRoot identity and playback gate remain intact.
- Search removes introductory filler, private-mode banner and footer. Recent searches, compact taste/trending chips, Tune taste and 44px playable/queueable rows lead directly into results. Room context and role restrictions remain. Scrollbars use the shared subtle theme color.
- Mood strip is transparent and relative rather than sticky. Home greeting uses the Library's italic serif signature, subtitles use pretty wrapping, actions use cohesive pills, and the collage frame is removed. Library hero is compact. Top breadcrumb, zero sidebar counts and redundant no-rooms paragraph are removed.

## Application verification

| Check | Result |
| --- | --- |
| Build | Pass, zero errors; main entry 441.35 KB / 139.48 KB gzip; no chunk-size warning |
| `integrity-unit.cjs` | 18/18 |
| `api-verify.cjs` | 12/12, controlled upstream |
| `integrity-browser.cjs`, development | 15/15 |
| `integrity-browser.cjs`, production preview | 15/15 |
| Enhanced `phase8_1-verify.cjs`, development | 22/22 |
| Enhanced `phase8_1-verify.cjs`, production | 22/22 |
| Final production fixture `p7_5-verify.cjs` | 7/7 |
| Final 4x CPU trace | 457ms maximum, 1289ms total, 10 long tasks; unchanged 750ms/3500ms budgets |
| `git diff --check` | Pass |

The new browser cases prove one click recovers both an expired HTTP 410 signed stream and an AbortError without another navigation; actual loaded audio must be >=60s and advancing. Desktop/mobile cases exercise Workout/Relax/Sufi live requests and changing track results, exclusion of short live results, real image rendering in the dock, matching canonical artwork, pixel-derived accent changes, non-overlapping scroll/dock bounds, no dock sleep selector, compact search rows, custom scrollbars and the editorial shell. Existing typography, queue, Room search, Back, audio identity, real recording failure, safe storage, sleep timer and memoization checks remain green.

The first regression exposed a tablet drawer boundary overlap after increasing the dock height; its bottom boundary was corrected and the complete suite rerun. Subsequent complete regressions passed at 397ms and then 457ms maximum after adding smooth ambient interpolation. Performance limits and assertions were not weakened. Final Library/layout refinements were also checked by the full regression and fresh responsive screenshots.

## External provider / upstream status

A separate real request through production-preview `/api/saavn/api/search/songs?query=Atif%20Aslam&limit=2` returned **HTTP 429**, JSON, zero songs. The upstream is currently rate-limiting that request. This is separate from controlled application/API verification and means live catalog/stream availability is not certified. No successful live streaming claim or Vercel deployment is made.

Browser playback verification uses real Chromium media decoding with controlled audio/catalog responses; artwork/palette screenshots use controlled SVG image fixtures. The fixture helper now preserves each integrity case's configured duration and audio URL when live Home searches run, so refreshes cannot accidentally replace a 30-second test with 180-second media. No synthetic voice fallback was introduced in application code.

Reference repositories consulted: [Echo-Music](https://github.com/EchoMusicApp/Echo-Music), [saavn-extension](https://github.com/EchoMusicApp/saavn-extension). The implementation keeps EchoSync's existing same-origin API contracts.

## Fresh screenshots

Images and raw logs/traces are local ignored verification artifacts under `performance-results.local/part1a/`. These are controlled-fixture visuals, not evidence of upstream availability.

- [Desktop Home](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1a/production/part1a-home-1440.png>)
- [Search dropdown](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1a/production/part1a-search-1440.png>)
- [Library](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1a/production/part1a-library-1440.png>)
- [Active Player Dock](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/part1a/production/part1a-dock-1440.png>)

Matching 390px captures, all intermediate/final logs, live-provider probe output, and final Chromium trace/CPU profile/summary are retained in the same artifact directory. Final regression evidence is in `closure/` and `closure.log`.
