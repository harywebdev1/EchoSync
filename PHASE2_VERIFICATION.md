# EchoSync Phase 2 verification

Started from a clean working tree at Part 1B commit `cfcbb39`.

## Delivered behavior

- Home combines partial mood-query successes, ignores the shared backoff for explicit fresh requests, clears backoff after valid results, and gives the catalog request enough time for the server's bounded fallback. The offline notice appears only when the query pool yields no valid full-length tracks. Home ranking and catalog merging share a Unicode-normalized title/primary-artist stem, including removal of `(From "…")` suffixes.
- Musical channel profiles show a real 0–99% taste match, up to two shared artists/vibes, shared current listening and public-room activity, three rotation tracks, and public playlists with Play/Save. Empty taste and activity privacy have explicit states. Playlist visibility defaults to Public; Private collections are omitted from profile broadcasts and fallback reads. Saved collections are independent copies.
- The profile is reachable from Lounge authors, Room Chat authors, the Room member strip, and the Members dialog. It renders in the app overlay layer to avoid clipping by drawer blur/containment, stays within desktop/mobile viewports, and supports Escape/outside dismissal and focus restoration. The private-room invitation CTA remains available under existing invite rules.
- Lounge and Room Chat support structured song messages with 44px artwork and Play/Like/Queue controls. Shared playback uses the existing verified-duration engine and opens personal playback on Home; it does not seize another room's transport. Root audio identity is preserved.
- Room stage and the now-enabled Room Queue drawer expose per-user upvotes. Upcoming tracks sort by descending active votes with original insertion order as the tie-breaker; the active track stays first in the visible Room queue. Vote removal restores tie order. Timestamped operations merge idempotently across the existing room channel, including stale room updates, and persist with rooms.
- Member dots display actual reported playback-clock drift using the existing <300 / 300–1000 / >1000 ms thresholds. Missing/stale telemetry shows Awaiting sync. Admin/DJ Sync All sends a timestamped authoritative snapshot; receiving code checks room role and timestamp freshness. Listener requests are ignored.
- Light-mode active mood chips use #111827/#FFFFFF. Empty playlist covers use one musical note and empty card playback is unavailable. Settings has separated password copy, centered initials, a musical status summary, one Sign out action in its navigation, and a thin content scrollbar.

## Application verification

| Check | Result |
| --- | --- |
| `npm run build` | PASS, entry **451.19 KB** / **142.78 KB gzip**, below 500 KB; no errors |
| `node integrity-unit.cjs` | **20/20 PASS** |
| `node api-verify.cjs` | **13/13 PASS** |
| `node integrity-browser.cjs` (production preview) | **15/15 PASS** |
| `node phase8_1-verify.cjs` (production preview) | **22/22 PASS** |
| `node phase2-verify.cjs` | **7/7 scenario groups PASS**, desktop 1440×900 and mobile 390×844 |
| `ECHOSYNC_FIXTURE=1 node p7_5-verify.cjs` (production preview) | **7/7 PASS**, release run maximum **478 ms** at 4× CPU, unchanged 750 ms budget |

Earlier full fixture runs also passed 7/7 with maxima of 464 ms, 707 ms and 449 ms. These are measured runs, not a guarantee of identical timings on other hardware or under different host load. The existing redesign suite caught an initial 11px sync label; the implementation was raised to 12px without relaxing its typography check.

New unit coverage checks partial-query failure handling and stem deduplication, immutable vote operations, multi-user counts, stale operation rejection, current-prefix preservation and original-order restoration. The focused browser script injects alternating 429/success responses, real channel events and fixture audio to verify profiles/privacy, both chat playback paths, upvote/unvote/reordering, Room drawer voting, authorized/unauthorized resync reception, root identity, persisted visibility, light contrast, empty playlist behavior, Settings layout, mobile song cards and mobile profile bounds/Escape.

The original integrity suite continues to cover the ≥60s playback gate, real recording failure/retry, safe storage recovery, room sync ownership, filters, sleep timer, mobile Back and Home render isolation. There remains one room BroadcastChannel owner; social messages are dispatched through it.

## External provider status

A separate live production-preview request to `/api/saavn/api/search/songs?query=Atif%20Aslam&limit=5` returned **HTTP 200**, `X-EchoSync-Catalog: jiosaavn-direct`, and ten results, all ≥60 seconds. The upstream returned more rows than the requested limit. This is a catalog availability observation at verification time; new live media URL byte probes were not required or claimed for this phase.

Unit/API and browser tests use controlled upstream/media fixtures. The injected 429 responses test application recovery and are not live-provider failures. No production deployment was performed.

## Architecture and scope

Profiles, activity, chat, room membership and votes use the existing local accounts/storage and same-origin browser-tab channel model. This phase does not introduce cross-device cloud presence, Supabase, or server-authenticated room authorization. Live profile/telemetry snapshots expire rather than showing stale listening activity indefinitely. Browser APIs stay in Web hooks/UI; `src/core/` remains free of browser globals.

## Screenshots and evidence

Screenshots use deterministic fixture media/artwork and disable capture-time animations.

- [Musical profile](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/phase2/musical-profile.png>)
- [Light Home](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/phase2/home-light.png>)
- [Settings in light mode](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/phase2/settings-light.png>)
- [Room voting and member drift](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/phase2/room-votes.png>)
- [Mobile song drops](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/phase2/mobile-song-drop.png>)
- [Mobile profile](<C:/Users/haryw/OneDrive/Desktop/Music App/performance-results.local/phase2/mobile-profile.png>)

Raw logs and CPU trace artifacts are retained locally under `performance-results.local/phase2/` (ignored artifacts).
