# EchoSync Phase 8.1 verification

Date: 2026-10-24. Starting state: clean `ac7ab22` (Phase 8.0C was already committed).

## Delivered behavior

- One canonical search input in the shell header, with inline clear, Ctrl+K and non-editable-field `/` shortcuts. Desktop sidebar and Home duplicate search controls removed; mobile five-tab navigation retained.
- Lazy anchored search command surface on desktop and a sheet below the input on mobile. Recent-search removal/clear, taste suggestions, mood categories, Top result/Songs, visible one-click Play/Like/Queue actions, Solo/Room targeting, and browser Back dismissal. Search actions preserve the playing root audio node.
- Home mood ranking, animated ambient tint, personalized collage hero and Supermix/Radio/Create Room controls. Twelve available picks use desktop three-column/four-row geometry and mobile four-row snap columns with a peek. Tablet retains two visible columns with horizontal continuation.
- Quick Picks prepare the selected track followed by up to 15 eligible taste-ranked catalog tracks, with no fabricated tracks when the available catalog is smaller. Start Radio continuously cycles its prepared station without changing the user's Repeat setting; it does not claim an unbounded supply of new provider recommendations.
- Listen again, four collage mix cards, fresh discoveries, forgotten liked favorites when available, and retained playlist actions. Shelf artwork is 172px desktop/144px mobile, with consistent card heights and clamped metadata.
- Global stylesheet typography below 12px raised to 12px or above; excessive positive tracking reduced. Product hierarchy uses 22px section headings, 15px track titles and 13.5px secondary metadata.
- Fixed reselecting an active/same-stream track: restart and play effects now run even when React batches pause/play updates or two catalog entries share one URL. The existing >=60s validation remains in the play path.

## Application verification results

| Check | Result |
| --- | --- |
| `npm run build` | Pass, zero errors; entry 438.92 KB / 138.54 KB gzip; no chunk-size warning |
| `node integrity-unit.cjs` | 15/15 |
| `node api-verify.cjs` | 12/12 |
| `node integrity-browser.cjs`, development | 15/15 |
| `node integrity-browser.cjs`, production preview | 15/15 |
| `node phase8_1-verify.cjs`, development | 18/18 logged checks |
| `node phase8_1-verify.cjs`, production preview | 18/18 logged checks |
| Production fixture `p7_5-verify.cjs` | 7/7 |
| 4x CPU interaction budget | 271ms maximum, 1495ms total, 12 long tasks; unchanged 750ms/3500ms limits |
| `git diff --check` | Pass |

The Phase 8.1 suite checks 1440px and 390x844 layouts, four collage cells, all 12 Quick Picks, mood ranking changes, automatic 15-track upcoming queue, continuous station-end playback, unchanged Repeat preference, equal shelf heights, anchored search geometry, recent-search removal, clear/keyboard entry, playable/likeable/queueable results, Room targeting, Back dismissal and persistent AudioRoot identity. It scans visible text across Home, Search, Queue, Library and Room for >=12px (numeric badge exception >=11px), and checks document/app horizontal overflow.

Existing browser integrity checks continue to cover short/unknown-duration media, real recording failure/retry, storage notices, navigation and MediaSession continuity, room channel ownership, sleep timer, queue chips, overlay history and zero Home executions during Queue/Shuffle/Repeat interactions. Desktop Home and mobile Search production screenshots were visually reviewed. An intermediate production test exposed header stacking over the mobile Queue close button; the layer order was corrected before the final passing suites. No performance or accessibility assertion was weakened.

## External provider / upstream stream status

All browser/regression evidence uses controlled catalog fixtures and real browser audio playback. The larger Phase 8.1 fixture exists only in the verification script. API tests use controlled upstream responses. These checks do not certify current live Saavn/YouTube availability, real microphone hardware, or a deployed Vercel environment. No deployment was performed.

## Evidence

Ignored `performance-results.local/phase8.1/` contains build, unit/API, development/production browser logs, responsive screenshots, regression output, Chromium trace, CPU profile and summary JSON. Re-run with `ECHOSYNC_URL` pointing to development or preview; use `ECHOSYNC_FIXTURE=1` for the production regression. `ECHOSYNC_UI_DIR` and `ECHOSYNC_PERF_DIR` select artifact destinations.
