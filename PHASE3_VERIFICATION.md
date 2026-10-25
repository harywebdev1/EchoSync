# Phase 3 verification

Implemented Supabase email/Google authentication, owner library migration and persistence, private Realtime transport alongside BroadcastChannel, room/lounge persistence, voice Storage uploads, SQL schema/RLS and an optional cleanup Edge Function. The unconfigured application retains local authentication and fixture behavior.

## Application verification

- Production build: zero errors; main entry 472.71 KB (149.90 KB gzip), below 500 KB. Supabase SDK is a separate 214.40 KB lazy chunk.
- integrity-unit.cjs: 20/20.
- api-verify.cjs: 13/13 using controlled upstream responses.
- phase3-verify.cjs: 13/13. The schema executes twice in embedded PostgreSQL. Tests exercise real RLS, ownership, private joins, listener role restrictions, atomic library rollback, and service-only retention selection. Two simulated remote clients without BroadcastChannel exercise clocks, FORCE_RESYNC, votes, telemetry, presence privacy, messages/reactions/song cards and uploads.
- phase3-browser.cjs: all four groups pass on production preview with a mock Supabase client. Covers Google redirect/email contracts, private migration with a full local cache, preservation of original local rooms, AudioRoot stability on token refresh, upload failure sending nothing, Retry with actual MediaRecorder bytes, HTTPS voice playback, and unconfigured SDK avoidance. Fake microphone devices exist only in the browser test configuration.
- integrity-browser.cjs: 15/15 on the final production build.
- phase8_1-verify.cjs: 22/22, including typography, scroll/layout and drawer dismissal.
- phase2-verify.cjs: all 7 groups pass.
- ECHOSYNC_FIXTURE=1 node p7_5-verify.cjs: 7/7 on final production preview, 4x CPU maximum 573 ms against the unchanged 750 ms limit (17 long tasks, 2166 ms total). The preceding focused run was 559 ms.
- Final browser logs and performance traces: performance-results.local/phase3/. Build, unit/API and embedded SQL contracts passed; git diff checks passed before commit.

## Performance investigation

Initial regression runs passed 6/7 with Queue-open maxima of 828 ms and 935 ms. Traces attributed the spike to row DOM creation plus layout during the opening click. Keeping Queue mounted while hidden reduced handler cost, but a subsequent full run still reached 935 ms despite a focused 728 ms pass. Offscreen Home shelves now use content-visibility:auto with remembered intrinsic heights to avoid re-laying out distant catalog content when the stage narrows. The unchanged focused 4x CPU test then passed at 559 ms.

The retained closed drawer has display:none and is excluded from active social-surface selectors. Dismissal readiness assertions check hidden visibility rather than DOM detachment; Back/history and AudioRoot checks remain intact. The 750 ms threshold and measurement window were not weakened. Earlier passing numbers alone were not treated as a reliable fix. Failed and passing traces remain in performance-results.local/phase3.

## Integrity and access design

Original local room/chat/invite/Lounge records and remembered local identity are preserved with separate cloud cache keys. Cloud hydration updates RAM even when optional local writes fail. Existing duration, recorder, telemetry, disposable-cache and root-audio guarantees remain covered by the integrity suites.

Profile tables are owner-only. A deliberately filtered public directory exposes identity and consent-filtered taste/activity, excluding email, likes and migration metadata. Private playlists require ownership. Authorized database RPCs derive actor identity from auth.uid(), validate room roles, and publish server events. Current-member inbox fanout prevents later private broadcasts reaching removed members with cached room subscriptions. Ordinary simultaneous library edits use last committed writes; room clocks retain the existing device wall-clock assumptions.

Voice files use the requested public bucket: anyone holding a URL can play its audio. Owner-folder policies protect uploads/deletes. The cleanup function deletes bytes through Storage, then replaces message content with an expiry notice; SQL alone does not delete Storage metadata. Hourly scheduling is documented and opt-in.

## External service status

No live Supabase project credentials were supplied. Schema installation in a hosted project, actual Google OAuth, hosted Realtime/Storage across physical devices, Edge deployment and scheduled cleanup have NOT been verified or deployed. Embedded PostgreSQL and mock client passes do not establish live service readiness. Existing provider routes were exercised through controlled API tests; live JioSaavn/YouTube availability was not rechecked for this change.

Follow docs/supabase-setup.md to install the schema, configure Google redirects and public environment variables, deploy cleanup, and perform the two-device live smoke check. Never expose the service-role key in VITE variables.
