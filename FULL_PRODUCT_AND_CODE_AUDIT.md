# EchoSync — Full Product and Code Audit

**Audit date:** 4 November 2026, Asia/Karachi. **Revision:** `688033e`. **Repository:** `C:\Users\haryw\OneDrive\Desktop\Music App`.

**Mode:** read-only application audit. No changes to `src/`, `server/`, `api/` or `supabase/`; no deployment, schema mutation, real account creation or live user-data writes.

**Evidence legend:** **R** = reproduced in rendered Chromium; **C** = confirmed source behavior; **A** = live advisory/API observation; **U** = unverified or inconclusive. P1 means release-blocking correctness/access/privacy work; P2 means substantial usability/reliability debt; P3 means polish. Scores below are engineering judgments, not calculated quality percentages.

**Coverage and limits:** all **112 files / 39,716 lines** under the requested directories were read into a content-hashed inventory and scanned; all nine CSS files were parsed for selectors/declarations. Build/Biome supplied additional application syntax checks. Critical render, playback, persistence and transport paths received deeper manual review. Browser work produced **82 primary snapshots and 19 additional state snapshots** across 360×780, 390×844 and 1440×900, plus targeted queue, Resync, transition, latency and real-provider probes. The inventory at the end records the file scope; it does not mean every branch received a browser test.

Guest and signed-in layouts used isolated local fixture identities; separate catalog/audio probes used real upstream requests. Desktop chat/voice and mobile Lounge were exercised. Mobile Room Chat could not be entered through the normal UI. Create/join dialogs were inspected, not submitted against the live cloud. OAuth, real account recovery, signed-in cross-device Supabase playback, private-room revocation and physical iOS/Android background behavior remain unverified. Some harness steps timed out; these are disclosed rather than counted as passes. No finite audit can establish that every bug or every timing interleaving has been found.

## 1. Executive Reality Check

**Verdict: a capable prototype with production-shaped infrastructure, not a dependable production music product.** Previous fixes are real, but their checks mostly prove narrow invariants. They do not establish usable mobile entrypoints, reachable long queues, coherent playback intent or trustworthy product claims.

| Area | Rating | Basis |
|---|---:|---|
| Desktop UI/UX | 5/10 | Broad functionality and clearer artist lines; inconsistent row actions, album behavior and redundant status chrome. |
| Mobile UI/UX | 3/10 | Room Chat/Voice entry missing, Library actions squeezed, queue heading crushed, long Up Next inaccessible. |
| Audio playback reliability | 4/10 | Persistent root is a sound foundation; real direct-audio starts took about 8–11 seconds in two probes; provider/IFrame behavior diverges. |
| Room sync stability | 4/10 | Ordering and position-only heartbeats improve the baseline; same-account ownership, failover, clock skew and paused Resync remain unsafe. |
| Search/recommendation intelligence | 5/10 | Real catalog results work; title-only identity merging, no continuation and several competing feed pipelines undermine relevance and speed. |
| Codebase cleanliness | 3/10 | Smaller `App.jsx`, but controller/engine/services remain huge; 19,547 CSS lines and hundreds of repeated selector strings. |

The ten most damaging problems are:

1. **P1/R:** a mobile listener cannot normally open the Room Chat/Live Voice feature that differentiates this product.
2. **P1/R:** long mobile Up Next queues contain tracks the user cannot scroll to.
3. **P1/R+C:** Resync restarts paused audio instead of only correcting position.
4. **P1/C:** playlist and liked-song row playback receive the wrong queue contexts.
5. **P1/C:** artist-agnostic title merging can attach another recording's metadata/stream to a retained local ID.
6. **P1/C:** heartbeat ownership identifies a user, not one tab/device, and has no robust lease/failover.
7. **P1/C:** private-room voice recordings are uploaded into a publicly readable bucket.
8. **P2/R:** Library commands and Room headings lose usable space on small screens.
9. **P2/R+C:** slow cold playback and excessive catalog fan-out make the app feel less immediate than the static mockup.
10. **P2/C:** album search masquerades as album playback; quality/verification labels imply capabilities the implementation does not establish.

Important counter-evidence: inspected multi-artist lines remained single-line; the root audio element is structurally persistent; the storage adapter retries after disposable-cache pruning; modal focus trapping and message-menu placement contain useful work. Those improvements should be retained.

## 2. Visual, Layout & Mobile-First UI/UX Bugs

Coordinates below are CSS pixels. A control beyond the viewport inside a deliberately scrollable strip is not automatically a bug; inaccessible scrolling, intrinsic-width collapse and clipped content are the actual issues.

| Finding | Measured evidence | Cause and concrete fix |
|---|---|---|
| **V1/P1: long Up Next cannot scroll — R** | 360px: `.fp-body` client height **680**, content height **1500**, computed `overflow: visible`; assigning `scrollTop=10000` leaves **0**. 390px: **744/1500**, also scrollTop 0. There are **26 rows**; last row occupies **y=1484–1540**, beyond either screen. | [src/styles/mobile-responsive.css:792](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/mobile-responsive.css:792>) overrides the later lower-specificity `.fp-body` scroll rule. `.fp-inner` clips overflow. Give the content viewport one definitive mobile selector with `min-height:0; overflow-y:auto`; verify last-row reachability, not just tab visibility. |
| **V2/P1: Library action collapse — R** | At 360, `.library-tabs` is **332px** wide but `.library-head-actions` is only **7.98px**, at x=338.02. At 390 it is **37.98px**. Desktop action group is **108.41px**. Liked mode adds another action into the same squeezed strip. | [src/styles/mobile-responsive.css:331](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/mobile-responsive.css:331>) and [src/styles/mobile-responsive.css:347](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/mobile-responsive.css:347>) create nested horizontal scrollers with a shrinkable action group. Put New playlist outside the tab scroller; move collection actions into a separate row/menu. |
| **V3/P2: crushed Room heading — R** | 360: “The room queue” is **76.23×85.5**, three lines; desktop **172.64×28.5**, one line. Actions/count take its remaining width; badge can be offscreen at **x=459.28**. | [src/views/RoomView.jsx:195](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/RoomView.jsx:195>) renders heading/actions/count as siblings in one section header. Existing mobile rules target `.room-head .section-head`, not this sibling queue header. Use a named `.room-queue-header`, full-width title, then independently scrollable actions. |
| **V4/P2: rooms count stacks — R** | Empty directory at 360: `0 ROOMS SAVED` is **37.81×54**, three lines. At 390: **54.39×36**, two lines. Desktop: **98.31×18**. | [src/views/RoomsView.jsx:34](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/RoomsView.jsx:34>) puts badge, count and Join with code in a competing flex row. Give count `white-space:nowrap; flex-shrink:0`; put Join in the header action slot rather than shrinking metadata. |
| **V5/P2: Quick Pick actions follow intrinsic text width — R+C** | 390px card ends at **x=376**; last action ends at **334.34**, leaving **41.66px**. Its x coordinate is unchanged from the narrower 360px layout. Computed card display is **flex**, despite later grid declarations. | [src/styles/home-and-shelves.css:1534](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/home-and-shelves.css:1534>) outranks generic `.quick-card`; `.quick-main` becomes `display:contents`; `.quick-copy` lacks a reliable growing track. Apply one matching-specificity three-column row contract. Reserve a right action column independent of title length. |
| **V6/P2: row copy taller than row — R** | Mobile Quick Pick: row **56px**, copy **57.59px**; copy starts about **0.80px above** the row. Artist line itself remains ≤24px. | [src/styles/home-and-shelves.css:2424](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/home-and-shelves.css:2424>) has no explicit text-button min-height reset while global/mobile control rules apply. Reset title-button height/min-height; constrain copy to two text lines, not two full controls. |
| **V7/P2: Room active-card controls are clipped/hidden — R+C** | At 360, card **332×127.59**, scroll extent **510×180**. Open full player starts at **x≈329–344**, mostly outside its visible column. `.now-foot` is hidden on mobile except when Retry exists. | [src/styles/mobile-responsive.css:2703](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/mobile-responsive.css:2703>) and [src/views/RoomView.jsx:153](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/RoomView.jsx:153>) prioritize several status/buttons in a 210px column. Put one sync indicator beside the track; move Resync/full-player/technical data into a menu. Keep a visible failure affordance. |
| **V8/P2: mobile playlist detail actions exceed screen — R** | 360: Add to Room starts **x=273.03**, width **110.44**; Edit **x=391.47**; Delete **x=462.22**. Horizontal action scrolling exists, but important management commands require an undiscoverable sideways hunt. | [src/views/LibraryView.jsx:122](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/LibraryView.jsx:122>) needs primary Play plus overflow menu on mobile, not six equal-priority pills. |
| **V9/P2: chat/composer underlay overlap — R+C** | Mobile Lounge panel uses **rgba(21,23,30,.62)** with **30px blur**. At 390 composer occupies **y=785–843**, bottom nav **788–844**, a **55px** intersection. Composer background is only ~82% opaque. | [src/styles/rooms-and-chat.css:511](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/rooms-and-chat.css:511>) and [src/styles/mobile-responsive.css:754](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/mobile-responsive.css:754>) leave the nav underneath a translucent active sheet. Use a near-solid reading plane, one intentional scrim, and inert/hidden underlying navigation while the sheet is active. Retain glass at its header/chrome. |

**Not confirmed as described:** readable “Good evening” text was not clearly visible through the inspected chat bubble area. Transparency/underlay overlap are confirmed; the exact quoted text bleed is not. Mobile Settings Sign out is absolutely positioned, but the settled Profile/Social bottom checks showed **no intersection** with Save profile/Save privacy at either phone size. Its layout remains fragile: [src/styles/modals-and-toasts.css:1348](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/modals-and-toasts.css:1348>) has another mobile override at line 1358; move it into normal flow rather than declaring a collision that did not reproduce.

Multi-artist checks found approximately **16px** mobile and **18px** desktop artist-line height, not vertical artist stacking. Adjacent inspected rows were 56px; album-equals-title suppression worked on Artist/User rows. The remaining failures are surrounding geometry and inconsistent row implementations.

Full-player outer dimensions settle to **360×780 / 390×844**. One broader scripted run captured displaced content during transitions; isolated 100ms and 1000ms repeats settled correctly at x=20,y=72. Treat the displaced capture as an unresolved transition artifact, not a proven permanent offset. The long-queue scrolling defect above reproduces independently.

## 3. Missing Entrypoints, Dead Links & Broken User Flows

| Flow | Finding and surgical correction |
|---|---|
| **Mobile Room Chat/Voice — P1/R+C** | StageBar's Toggle room chat is hidden at both phone sizes. [src/components/MobileBottomBar.jsx:61](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/MobileBottomBar.jsx:61>) accepts an unused callback, and renders Home/Rooms/Lounge/Library/Account without a Room Chat action. [src/views/RoomView.jsx:153](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/RoomView.jsx:153>) supplies no replacement. Add a contextual Chat & Voice button with unread count in the Room header/mini-player region. |
| **Resize closes chat — P2/R+C** | [src/hooks/useEchoSyncController.js:891](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useEchoSyncController.js:891>) closes chat on every small-width resize. Desktop-open chat became `.social` with `display:none` after resizing to mobile. Keyboard/orientation/viewport changes should not destroy the user's open-sheet intent. Reconcile layout only when crossing breakpoints. |
| **Library row playback — P1/C** | [src/views/LibraryView.jsx:186](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/LibraryView.jsx:186>) is in playlist detail; [src/views/LibraryView.jsx:297](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/LibraryView.jsx:297>) is in Liked songs. Swap to their actual source collections. Recently played uses its proper recent collection. |
| **Album cards — P2/C+R** | [src/views/ArtistProfileView.jsx:136](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/ArtistProfileView.jsx:136>) searches an album name and artist, then plays result zero. No album tracklist, ordering or album view exists. Preserve browseId and implement album browsing; distinguish opening an album from pressing its play button. |
| **Playlist management parity — P2/C** | Library rows/full player expose the picker, but Quick Picks/artist/user/search surfaces often expose Queue instead. Search's `onAddToPlaylist` prop has no visible picker action. Playlist reorder/share/permalink are absent; room/solo queue reorder is not playlist reorder. Use one row menu: Play next, Add to queue, Save to playlist, Go to artist, Share. |
| **Keyboard activation — P2/C** | Library `div[role=button][tabIndex=0]` rows lack Enter/Space handlers. Nested playlist Play `<em role=button>` also lacks keyboard activation. Search only handles Enter. Use accessible row primitives with separate actions, and audit nested anchor/button semantics. |
| **Profile navigation inconsistency — P2/C** | Author/avatar buttons open channels, but [src/components/MessageText.jsx:14](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/MessageText.jsx:14>) is wired to `insertMention` in chat/Lounge, so in-message @handles edit the draft. Mobile mini-player artist text is plain text inside the open-player button. Choose and expose explicit profile/artist actions consistently. |
| **Artist sharing — P2/C** | [src/views/ArtistProfileView.jsx:111](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/ArtistProfileView.jsx:111>) drops the artist browseId. Reload/share resolves by slug-derived name, potentially selecting an ambiguous different artist. Preserve canonical browseId in the share contract. |
| **Voice-note playback failure — P2/C** | [src/components/VoiceNoteBubble.jsx:41](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/VoiceNoteBubble.jsx:41>) catches playback rejection and resets silently; error does the same. Recording Retry is better handled than listening Retry. Show “Could not play recording” and a retry/download-safe action. |
| **Settings quality — P2/C** | UI offers 320/160/96 kbps, but [server/youtubeAudio.js:32](</C:/Users/haryw/OneDrive/Desktop/Music App/server/youtubeAudio.js:32>) always selects best and the request carries no quality choice. IFrame playback is a different backend again. Either implement a real supported policy or label the setting honestly. |
| **Guest/auth — R/U** | Guest Home and sign-in/signup sheets render at phone/desktop sizes. Account is the mobile entry. Actual Google OAuth, recovery email delivery and authenticated cloud persistence were not exercised; no claim of complete auth verification is made. |

Create Room, Join with code, role selection, own/other profiles, search empty/results, settings tabs, player panels and Lounge menu were inspected. Private passcode, leave handover, playlist picker/editor and error/retry surfaces were source-reviewed; not every destructive/error branch was submitted in-browser. This is a coverage gap to close before release, not an implicit pass.

## 4. Room Sync, Queue Disappearance & Realtime Architecture Flaws

### Queue disappearance: what the code actually proves

[src/views/RoomView.jsx:256](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/RoomView.jsx:256>) intentionally removes already-played rows from the rendered list. The heading/badge still uses **`queue.length`**, including history. A two-track Room reproduced **2 TRACKS + one visible row after Next** at all three sizes. At the last track's end it remained **2 TRACKS + one row + paused audio**. This is an inconsistent queue/count contract, not proof that songs were deleted.

The exact “1 TRACK badge, zero rows” case was **not reproduced**. [src/hooks/useEchoSyncController.js:515](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useEchoSyncController.js:515>) clamps the index to N−1, and unknown IDs become placeholders rather than being filtered out. For a finite valid index and N>0, this render filter must retain at least one row. Do not invent an ID-filter root cause. Capture queue IDs, current track ID/index, vote ordering and the visible slice from the real failing session. Separately, FullScreenPlayer excludes current/past rows and its empty state tests **total queue length <2**, so the final track of a larger queue can show a blank Up Next panel with no explanation.

**Fix:** model `history`, `current`, `upcoming` explicitly; derive all counts and empty states from the same visible projection; keep stable track IDs and assert missing hydration never deletes an entry.

### Confirmed/inferred transport risks

1. **P1/R: Resync changes playback intent.** [src/hooks/usePlaybackEngine.js:1571](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/usePlaybackEngine.js:1571>) computes a target then calls `setIsPlaying(true)` unconditionally. Paused→Resync produced `audio.paused=false` at 360, 390 and desktop. Split join/unlock from position-only resync; respect authoritative `isPlaying` and role permissions.
2. **P1/C: user ownership is not device ownership.** [src/hooks/useRoomSync.js:94](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useRoomSync.js:94>) writes `lastActorId=currentUser.id`; heartbeat/advance checks compare that same user ID. Two tabs using one account both qualify. Add an authenticated actor plus distinct controller/session lease ID; never use user ID as the single-device lease.
3. **P1/C: no dependable owner-loss failover.** [src/hooks/useRoomSync.js:225](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useRoomSync.js:225>) refuses to advance unless the last actor is this user. Closing/background-suspending that actor can strand continuation; another DJ must act manually. Use an expiring server lease and takeover rule, with term/version fencing.
4. **P1/C: timestamps are ordering, not a synchronized clock.** `Date.now()` and lexical actor ties are not a server sequence or clock-offset estimate. Source accepts equal ordering tuples; the SQL bound permits future timestamps up to 15 seconds. A skewed controller can temporarily fence out another device's valid actions. Introduce server-issued revision/idempotency keys and measured clock offset; test skew separately from network delay.
5. **P1/C: IFrame correction is incomplete.** [src/hooks/useRoomSync.js:359](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useRoomSync.js:359>) nudges only the HTML audio element. [src/hooks/usePlaybackEngine.js:253](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/usePlaybackEngine.js:253>) manages an independent IFrame. A remote Pause immediately pauses HTML audio, while IFrame pause awaits the React effect; small-drift correction does not affect the audible IFrame. Give both backends a shared seek/pause/rate capability contract and explicit unsupported-rate behavior.
6. **P2/C: the nudge is too weak to promise convergence.** 1.03× for 1.5 seconds corrects about **45ms**, not a 0.5–2.5 second offset. With 10-second heartbeats, large allowed drift can persist for minutes. Tune duration/rate against actual error/clock uncertainty; preserve no-small-hard-seek behavior.
7. **P2/C: rejected cloud actions are mostly console warnings.** [src/hooks/useRoomSync.js:389](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useRoomSync.js:389>) and [src/cloud/realtimeTransport.js:39](</C:/Users/haryw/OneDrive/Desktop/Music App/src/cloud/realtimeTransport.js:39>) allow optimistic local state to diverge from a rejected/failed remote write. Add acknowledged/pending/failed command state and reconciliation. Preserve the dedicated command lane and server membership authorization already present.
8. **P2/C: two separate notions of “bad drift.”** [src/core/roomSyncMath.js:18](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/roomSyncMath.js:18>) warns at 300ms, while correction starts at 500ms. [src/components/TelemetryPill.jsx:31](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/TelemetryPill.jsx:31>) can produce “Drifting 476 ms drift.” Keep precise diagnostics in details; communicate “Synced” versus “Catching up” without alarming on tolerated error or repeating words.

### Latency evidence and limits

A test-only relay added fixed one-way delay between two isolated Chromium contexts, using the application's messages. At **150ms**, one promotion measured **1059ms** and a later UI action timed out. At **800ms**, promotion measured **1488ms**, Pause **1398ms**, and a no-hard-seek assertion fired. These are **failed/inconclusive audit runs**, not a release pass or a clean network-only benchmark. The reused assertion starts counting seeks after a title update, before proving new-media readiness, so it can count an allowed track-load seek. The result warrants targeted trace instrumentation; it does not prove once-per-second stutter.

An unconditional <500ms remote-delivery promise is physically incompatible with 800ms one-way delay. Define separate local-response and remote-convergence budgets. Real devices, packet loss/reordering, same-account tabs, owner loss, clock skew and background/lock-screen behavior still need a controlled soak test.

### Cloud privacy/persistence

- **P1/C:** [supabase/schema.sql:259](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/schema.sql:259>) makes `voice-notes` public; a read-only live bucket query also confirmed **public=true** and a **10MB** object limit; [src/cloud/cloudAdapter.js:76](</C:/Users/haryw/OneDrive/Desktop/Music App/src/cloud/cloudAdapter.js:76>) stores public URLs even for private-room recordings. Row membership protection does not revoke knowledge of a public object URL. Use private storage with short-lived authorized access and verify removed members cannot fetch recordings.
- **P1/C:** whole-library saves replace profile arrays and delete playlists absent from the submitted snapshot: [supabase/schema.sql:241](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/schema.sql:241>). Combined with [src/hooks/useCloudBackend.js:56](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useCloudBackend.js:56>), concurrent devices can overwrite each other's changes and remote updates may be ignored while dirty. Add revisions/conflict handling or operation-based mutations.
- **A:** live Supabase advisor reports one security-definer-view error (`profile_directory`), four anon-executable-definer warnings, seven authenticated-definer warnings and disabled leaked-password protection. These are findings to assess, **not seven proven exploits**: authenticated mutation RPCs intentionally require definer privileges. Keep the sanitized public-directory projection; do not blindly enable `security_invoker` and break public browsing. [Advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).

## 5. Audio Engine, Search & YouTube Music Audit

**Actual architecture:** [server/ytmusicHandler.js:5](</C:/Users/haryw/OneDrive/Desktop/Music App/server/ytmusicHandler.js:5>) is a hand-written InnerTube `WEB_REMIX` parser with a fixed client version; [server/youtubeAudio.js:7](</C:/Users/haryw/OneDrive/Desktop/Music App/server/youtubeAudio.js:7>) performs direct extraction. Python `ytmusicapi` is not running here. `server/saavn.js` and `/api/saavn` are aliases to YouTube Music, not an independent JioSaavn provider. The media allowlist still includes historical CDN hosts, and fixtures use Saavn-shaped test URLs; neither proves live Saavn fallback. Current source does not implement an active iTunes fallback.

**Why searches can be sparse/slow — C:**

- [server/ytmusicHandler.js:546](</C:/Users/haryw/OneDrive/Desktop/Music App/server/ytmusicHandler.js:546>) waits for both unfiltered and songs-filter requests. A slow optional filtered pass can delay useful primary results to the request deadline.
- No continuation-token/page implementation exists. Asking for 50/60 only truncates one parsed response; it does not guarantee that many upstream tracks.
- [src/core/trackIdentity.js:42](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/trackIdentity.js:42>) deliberately ignores artists. Same-title songs, covers and alternate versions collapse. Worse, [src/core/moodFeed.js:38](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/moodFeed.js:38>) overlays the live track onto the old object while retaining the old ID. A pure-function reproduction returned ID `saved-original` with `Cover Artist` and the cover stream URL after merging equal titles. This changes recording identity under an existing reference. Dedupe display variants with artist/version-aware identity; never swap recordings under saved IDs.
- [src/core/moodFeed.js:8](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/moodFeed.js:8>) discards unknown-duration mood tracks even though search admits unknown duration. That inconsistency reduces recommendations.
- [src/lib/appServices.js:1424](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/appServices.js:1424>) otherwise returns an empty array on search failure; radio does the same. Several callers cannot distinguish unavailable upstream from genuine zero results.
- Home combines daily feed, dynamic taste, live mood and `useYtHomeFeed` queries. Their different query/limit/cache keys duplicate work. Current probes observed **34–43 catalog responses** in short real-browser sessions.

**Playback — C/R/U:**

- Direct extraction returns expiring signed URLs; client/server caches and range proxy add failure points. The server tries multiple emulated clients and has a 12-second handler deadline; racing a promise does not cancel all extraction work. Media proxy bounds audio responses to 1MB and artwork to 4MB, validates redirects and awaits streaming—useful safeguards to retain.
- The engine can choose a hidden persistent IFrame while warming direct audio. Root `<audio>` identity tests do not validate IFrame autoplay, lifecycle, background continuation or rate corrections.
- Catalog `>=60s` filtering exists, but [src/hooks/usePlaybackEngine.js:1964](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/usePlaybackEngine.js:1964>) accepts positive real duration without enforcing >=60 for signed-in playback. `handleAudioReady` uses >=60 for preloading, not a playback block. The current integrity test explicitly accepts short media behind a 180-second catalog entry. Decide the intended full-track contract; the earlier strict media-duration guarantee is not currently established. Keep the intentional 30-second guest preview separate from this issue.
- Current direct-audio probes observed approximately **10,761ms guest** and **8,071ms seeded local-user** from the pre-click timestamp to HTML `playing`. These are single observations including automation dispatch, not medians or physical-device audio-output measurements. An earlier guest direct resolver returned **502**; no first-audio event was observed in its wait window, and IFrame detection in that first probe was incomplete. Do not label the entire guest path permanently broken from that run.
- Chrome/iOS playback policies require platform-aware user activation and careful handling of asynchronous/source-switching play calls. `playsinline` and Media Session are useful but do not prove background/lock-screen reliability. [Chrome autoplay documentation](https://developer.chrome.com/blog/autoplay), [WebKit policies](https://webkit.org/blog/6784/new-video-policies-for-ios/).

**Recommendation parity:** uncredentialed public searches plus seed radio are not the listener's authenticated YouTube Music home/recommendation model. Hard-coded artist/language labels, local weights and mood keywords still shape shelves. Call them EchoSync mixes; avoid implying personalized access to a user's YouTube account/history.

## 6. AI Slop, Useless Features & Dead-Code Bloat

| Current copy/widget | Why it is misleading/noisy | Replace/remove |
|---|---|---|
| “Everything that sounds like you”; “Find your frequency”; repeated generic bios | Consumes scarce mobile space without helping the next action. | “Library”, “Rooms”, optional user-written bio. |
| “PLAYING NOW · YOUTUBE MUSIC”, source badges, track counters in several places | Repeats track/player context; catalog origin is not playback health. | One title/artist pair; provider details in overflow. |
| “Drifting … drift” | Duplicated wording and tolerance mismatch. | One calm sync label; diagnostic milliseconds on demand. |
| “Everyone stays in sync” | Unconditional guarantee contradicted by backend/network limitations. | Remove the guarantee; keep a contextual role explanation only when relevant. |
| “Verified artist” for any browseId; “Verified listener” for `member.cloud` | Catalog/cloud existence is not identity verification. | Remove badges unless a real verified claim is supplied. [src/views/ArtistProfileView.jsx:162](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/ArtistProfileView.jsx:162>), [src/views/UserProfileView.jsx:238](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/UserProfileView.jsx:238>). |
| 320/160/96kbps choices and “320 kbps” fallback display | Not enforced by direct extraction; fallback display can be guessed. | Actual supported bitrate/Auto; no invented quality. |
| “Top result / N streams” | Results are catalog entries, not N validated playable streams. | “Songs”; count actual visible results if useful. |
| “This view hit a wrong note … playback … still safe” | Cute error copy asserts safety the boundary cannot establish. | “Could not open this page. Try again.” |
| Admin/DJ labels + You have control + Sync All + Resync + Retry | Too many competing explanations/actions around one track. | One role badge, one sync state, contextual recovery menu. |

**Structural bloat:** `useEchoSyncController.js` **3612 lines**, `usePlaybackEngine.js` **2402**, `appServices.js` **2245**, `App.jsx` **922**. Extracting a large function into a “hook” did not create clear subsystem ownership. State modules contain **84 `useState` calls and 67 refs** combined; several describe overlapping queue/clock/player snapshots.

The nine CSS files contain **19,547 lines**, **2745 rule nodes** and **435 repeated exact selector strings** including keyframe-step selectors. These counts include legitimate media variants; they are not a claim of 435 dead rules. `.stage-scroll` appears 10 times, `.stage-bar` 9, `.now-card` 8. Conflicting specificity—not import order alone—causes real defects. Use a selector/ownership map and remove superseded declarations after visual approval, not another patch section.

Residual scaffolding includes queue-filter state exported without visible chips; sleep timer engine/state exported without player controls; test-retained queue filtering/taste-match helpers; underscore-prefixed unused local computations; legacy `fetchJioSearch` naming; an obsolete Saavn/mirror comment in SearchOverlay. Choose retain-and-wire or remove; do not count test imports as proof of product use.

`window.__ECHOSYNC_SUPABASE__` is a production-shipped override seam, not itself a server-auth bypass. Document/isolate test configuration rather than presenting it as a security exploit. Local-mode accounts store passwords directly and accept four characters; this must be explicitly local/demo behavior, never a silent substitute for broken cloud configuration.

Voice waveforms are seeded decoration, not amplitude analysis: [src/lib/voice.js:1](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/voice.js:1>). That does **not** mean fake audio is sent. Recording code still obtains actual media; voice-note playback errors need a visible failure state.

**Why clean checks miss this:** Knip uses `--no-exit-code`; test imports keep unused product helpers reachable. Biome uses preset `none` with a small rule selection, not a broad accessibility/hooks audit. Passing those commands cannot certify CSS geometry, semantics or architecture.

## 7. Useful Features & UX Details Skipped or Half-Built

- **Albums:** implement browseId-backed album detail/track order/artists/runtime; distinguish open, play and shuffle. A text search is not an album contract.
- **Playlists:** one save picker reachable from every song surface; reorder within a playlist; consistent rename/delete/privacy; real shareable routes. Fix queue context before adding bulk actions.
- **Room continuation:** [src/hooks/useRoomSync.js:239](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useRoomSync.js:239>) stops at the end; room playback returns before the solo autoplay branch. `primeRadioQueue` excludes rooms. Add an explicit host-controlled Room Autoplay setting with one authoritative append command, dedupe and unavailable-provider empty state. Do not silently inject radio into deliberately finite queues.
- **Up Next:** name current/upcoming/history consistently; correct last-track empty state; make long lists reachable; expose reorder/remove permissions; retain current audio when editing the queue.
- **Profiles:** own Edit profile and Settings open the same surface. Other channels depend on directory/live snapshot availability; a reload with sparse metadata can feel empty. Public playlists exist but follow/subscription, durable profile music collections and full channel parity are absent. These are product decisions, not features to fake with badges.
- **Lyrics:** translation is a separate external endpoint, not guaranteed English lyrics. Transliteration is not translation. Surface instrumental/unavailable/loading states clearly; keep lyric-source labels in diagnostics. Do not promise complete synced lyrics for all tracks.
- **Recording/listening:** recording Retry exists; playback/download/expired-note state is weaker. Browser decode support is required by `isUsableVoiceBlob`; actual Safari codec behavior remains unverified.
- **Recovery:** distinguish queued/pending/failed cloud changes and unavailable tracks without deleting likes. [src/hooks/useEchoSyncController.js:773](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useEchoSyncController.js:773>) removes liked IDs absent from current library state; [src/lib/appServices.js:426](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/appServices.js:426>) removes preview library entries during startup cleanup. Missing/unverified catalog data should produce placeholders, not deletion of user intent.
- **Real device polish:** safe areas, on-screen keyboard, focus restoration, screen reader navigation, lock-screen Next and source-switching playback need device coverage. Chromium viewport size alone does not test Safari or Android lifecycle.

## 8. Performance, Speed & 60FPS Responsiveness

| Measurement | Current evidence | Interpretation |
|---|---|---|
| Main entry | **495,598 bytes**, gzip about **158.39KB** | Passes 500KB gate with only ~4.4KB headroom. |
| Total generated JS | **64 chunks**, **1,003,363 bytes** uncompressed | Not all initial downloads. Retry imports generate duplicate view/overlay chunks; lazy splitting has real cost/benefit. |
| Main CSS | **304,818 bytes** uncompressed | Large render-blocking stylesheet for a comparatively small product. |
| Next-largest JS chunk | **214,403 bytes** | Lazy Supabase dependency chunk; do not count it as main-entry bytes. |
| Live local catalog | Samar query first request and other queries recorded separately; collaboration **983ms**, Chaleya **636ms** | End-to-end requests, not isolated server cold-start timings. |
| Live production catalog | Samar **1894ms/26 songs**; collaboration **1412ms/27**; Chaleya **1026ms/32** | HTTP 200 snapshots, not an uptime/reliability guarantee. |
| Direct first audio | Guest **10.761s**, local-user **8.071s** | Too slow for a credible instant-play claim; single-attempt observations. |
| API fan-out | **34–43 catalog responses** during short real-browser probes | Consolidate/coalesce feed requests before adding more recommendation layers. |
| Live production load waterfall | Browser navigation exceeded **30s** in one probe | Inconclusive; cannot claim current production FCP/TTI/LCP or cold-start certification. API availability is separate. |

Dev resource probes transferred roughly **13–15MB**, including a ~5.2MB dev icon module and ~3.1MB React DOM module. **These are development-module bytes, not production bundle sizes.** They are included to explain the dev waterfall, not to mislabel the shipped app as a 15MB entry bundle.

Progress updates primarily go through [src/state/playbackStore.js:59](</C:/Users/haryw/OneDrive/Desktop/Music App/src/state/playbackStore.js:59>). MobileMiniPlayer, player timelines and LyricsPanel subscribe; `timeupdate` does not directly set global App time state. Do not claim the entire catalog rerenders on every audio tick. Broader work comes from two-second social/context publications, feed/library/cover-healing updates, and controller recomputation. [src/hooks/useSocialFeatures.js:102](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useSocialFeatures.js:102>) returns a fresh context object; consumers can rerender even when their own slice is unchanged. IFrame polling also updates duration/buffering, sometimes redundantly.

A current isolated 390px Room scroll sample recorded **33.3ms p95 frame interval** and **418ms longest task** at normal CPU speed. Treat this as a dev-environment observation, not a device-wide benchmark or proof of compositor behavior. At 4× CPU throttling, the same 89-interval sample recorded **4716.1ms p95** and a **10,541ms longest task**: a failed stress sample. No calibrated idle-machine baseline or task trace was captured, so these extreme values cannot identify a particular component or predict every device. They emphatically do not certify 60FPS. React commit-hook instrumentation did not produce a usable trace after two attempts; specific per-component runtime render counts are therefore **not established**. Obtain a production profiling build and Chrome performance trace before claiming a named component is the measured long-task root cause.

Keep static isolated ambient layers and removal of repeated-row backdrop blur. Large fixed surfaces still use 30–64px blur plus artwork blur up to 110px; 60FPS is not established merely because those surfaces are overlays. The palette extractor, synchronous JSON storage/cache writes and repeated full-profile broadcasts also belong in the next trace.

## 9. Product Designer Benchmark & Spatial Map

This is an interaction/design comparison, not a claim that authenticated YouTube Music and a native Echo-Music installation were exhaustively tested in this audit. Google's playlist documentation establishes consistent save/edit/reorder flows; EchoSync's exposed commands vary by surface. [YouTube Music playlist reference](https://support.google.com/youtubemusic/answer/7205933?hl=en).

Echo-Music is a native Android reference, with its own player/lyrics/library surfaces. Its design guide uses glass selectively with explicit rendering tradeoffs and fallbacks. Copying its translucency into a browser does not reproduce native performance or background playback. Borrow hierarchy and navigation, while retaining EchoSync's existing obsidian canvas, fonts and song accents. [Echo-Music repository](https://github.com/EchoMusicApp/Echo-Music), [design guide](https://raw.githubusercontent.com/EchoMusicApp/Echo-Music/main/DESIGN.md).

| Screen/region | Desktop: where it should live | Mobile: where it should live | Remove/avoid |
|---|---|---|---|
| Global header | Search, room context, Lounge, account menu. | 54px header: compact logo, search, one account/overflow action. | Multiple competing profile/Lounge/chat glyphs in the search slot. |
| Navigation | Sidebar: Home, Rooms, Library, playlists; profile plus separate settings menu. | Bottom nav with stable destinations. Room Chat is a contextual action, not a hidden Library indicator. | Unused callback props and unread badges with no corresponding entry. |
| Home hero | One greeting, primary mix/play action, optional compact discovery artwork. | Mood strip, short greeting, restrained swipeable tiles. | Moving promotional carousel competing with the actual song list. |
| Song row | 44px art; flexible title/artist; fixed action rail/duration. | 56px row, two text lines, 44px art, one overflow plus optional heart. | Intrinsic-width action positioning, duplicate album/title, many tiny icons. |
| Library | Tabs, distinct New playlist action, grid/list, coherent detail toolbar. | Tabs scroll independently; New action remains reachable; detail overflow menu. | Nested action scroller that shrinks to 8px. |
| Artist channel | Banner/title, meaningful artist metadata, Play/Radio; songs, actual albums, related artists. | Compact banner/header; primary play action; flat song list. | Fake verification and album-search-as-album-playback. |
| User channel | Identity/bio, public collections/listening, own edit or other-user invite. | Same hierarchy with shorter header and manageable actions. | Duplicate edit/settings prominence and generic promotional bios. |
| Player bar | Track/artist; central transport/timeline; queue and volume. | 58px mini-player above nav, title/artist, Play and Next; full-player tap zone. | Technical drift/quality labels in the compact player. |
| Full player | Track/art/control left, Lyrics/Up Next content right with genuine scroll viewport. | Full 100dvh: 52px header, bounded art, title/artist, seek, five transport controls; 48px bottom tabs. | Non-scrollable long queue, multiple redundant queue counters, source kicker. |
| Room header | Title/privacy, members/roles, Invite and overflow. | Title row, visible Chat & Voice with unread; compact member/action strip. | Crushed metadata counts and ambiguous sideways-only primary actions. |
| Room stage | Current track, one sync state, queue with current/upcoming/history semantics. | 84px cover beside two text lines; sync state; separate full-width queue heading/actions. | Admin/control/quality/Retry/Resync/Sync All all at equal visual priority. |
| Chat/Voice sheet | Stable side panel, readable messages, menu anchored within viewport, composer and voice controls. | Near-solid full-height reading/composer plane; clear close/back; nav inert; keyboard-aware composer. | Background text/nav under active reading plane; hidden entrypoint; viewport resize auto-close. |
| Settings/Auth | Named dialog, normal-flow sidebar/footer, visible save state. | Scrollable bottom sheet; tabs in horizontal strip; content and sign-out have independent normal-flow placement. | Floating sign-out over potential content; claims unrelated to implemented settings. |

The product should feel like a music player with social listening, not a dashboard of sync diagnostics. Keep precision in a details panel; preserve calm primary listening surfaces.

## 10. The Master Execution Blueprint

### Stage 1 — Stop incorrect behavior and restore mobile access

1. **Playback intent:** `usePlaybackEngine.acceptJoin`, `useRoomSync`, RoomView Resync wiring. Separate join/play from resync; test paused listener/controller on both backends. No unsolicited resume.
2. **Track/queue integrity:** LibraryView context swap; RoomView/current/upcoming count contract; FullScreenPlayer last-track empty state; `trackIdentity`/`mergeMoodCatalog` artist/version safeguards. Never replace recordings under saved IDs.
3. **Entrypoints/reachability:** MobileBottomBar/StageBar/RoomView visible Chat & Voice entry; remove unconditional resize close; fix specific `.full-player .fp-body` scrolling; test final row of a 30-track queue and keyboard changes.
4. **Data/privacy:** private voice-object access and revocation design in schema/cloud adapter; remove implicit liked-ID deletion; revision/conflict policy for full-library saves. Audit existing directory/definer advisories without blindly revoking intentional RPCs.
5. **Gate:** regression cases for each defect, actual role/permission checks, unchanged root identity, preserved guest policy, zero unintended user-data deletion. Baseline unit/API passes alone are insufficient.

### Stage 2 — One coherent mobile/desktop product layout

1. Consolidate row and toolbar ownership in the existing CSS partials; eliminate superseded selectors after approval. Fix Library tabs/actions, Room queue header, directory count and Quick Pick right rail at 360/390/1440.
2. Make chat reading/composer surfaces opaque enough, trap focus/inert underlays, preserve Back behavior, and keep a stable keyboard-aware composer. Put settings sign-out in normal flow.
3. Standardize row menu semantics across Quick Picks/Search/Library/Profiles/Queue; implement keyboard activation and reliable hit areas.
4. Replace album search with browseId-backed Album view; add coherent playlist reorder/share routes. Correct artist share URLs and remove unearned verification badges/quality claims.
5. Rewrite the copy inventory above; collapse redundant role/sync/source chrome. Preserve fonts, #030303 and dynamic song accents.
6. **Gate:** settled AND transition screenshots; nested text/action bounds; last-row scroll reachability; no clipped primary actions; tabs/menus with keyboard and touch. Obtain human visual acceptance before broad CSS deletion.

### Stage 3 — Production reliability and measured speed

1. Introduce server-authoritative command revisions, idempotency and a controller-session lease with takeover/fencing. Estimate clock offset; reconcile rejected optimistic actions. Add equivalent capabilities for HTML audio and IFrame.
2. Define explicit Room Autoplay and authoritative radio append; recover from controller loss/backgrounding; avoid multiple tabs of one account competing.
3. Coalesce Home/feed/search requests; cancel obsolete work; avoid waiting for optional search enrichment; add continuation and distinguish error/empty. Preserve genuine artist/version identity.
4. Wire real audio quality policy or remove the selector. Measure resolver cancellation, expiry, media ranges, TTFA and stalled IFrame recovery before tuning cache/preload strategy.
5. Profile production builds, context publications, storage serialization, artwork healing and fixed blur. Remove duplicate retry bundles only after choosing a tested chunk-recovery strategy. Reduce CSS and entry headroom risk without a cosmetic rewrite.
6. **Release gate:** repeated cold/warm Guest and cloud-user TTFA percentiles; two real devices plus same-account tabs; 150–800ms delay with jitter/loss/reordering/skew; controller disappearance; paused resync; long queue; screen lock/background Next on physical iOS Safari and Android Chrome. Report local-response, convergence and upstream failures separately. Do not promise a flawless release before these pass.

### Verification ledger and source inventory

- Current audit baseline: **audit:clean PASS**, **build PASS**, **38/38 unit PASS**, **13/13 API contracts PASS**. These pass despite the reproduced product bugs above.
- Browser audit is an evidence matrix, **not an all-green suite**. Main harness's first six chat/Lounge steps used wrong input selectors; corrected follow-up exercised Lounge and desktop Room Chat/Voice. Mobile resizing independently closes Chat. Desktop signup switching was not completed by one helper and remains a coverage limitation.
- All **112 source-file hashes matched** the pre-audit inventory after inspection. Temporary scripts/screenshots are removed under the repository's instructions; measured JSON/log evidence remains in the ignored audit-artifact directory. No commit/push/deploy was requested or performed.

The following inventory covers every requested file. Line counts include trailing blank lines and are not complexity scores.

- [api/media.js](</C:/Users/haryw/OneDrive/Desktop/Music App/api/media.js>): 2 lines.
- [api/saavn.js](</C:/Users/haryw/OneDrive/Desktop/Music App/api/saavn.js>): 2 lines.
- [api/youtube-audio.js](</C:/Users/haryw/OneDrive/Desktop/Music App/api/youtube-audio.js>): 2 lines.
- [api/ytmusic.js](</C:/Users/haryw/OneDrive/Desktop/Music App/api/ytmusic.js>): 2 lines.
- [server/media.js](</C:/Users/haryw/OneDrive/Desktop/Music App/server/media.js>): 104 lines.
- [server/saavn.js](</C:/Users/haryw/OneDrive/Desktop/Music App/server/saavn.js>): 8 lines.
- [server/youtubeAudio.js](</C:/Users/haryw/OneDrive/Desktop/Music App/server/youtubeAudio.js>): 74 lines.
- [server/ytmusicHandler.js](</C:/Users/haryw/OneDrive/Desktop/Music App/server/ytmusicHandler.js>): 626 lines.
- [src/App.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/App.jsx>): 922 lines.
- [src/cloud/cloudAdapter.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/cloud/cloudAdapter.js>): 82 lines.
- [src/cloud/realtimeTransport.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/cloud/realtimeTransport.js>): 109 lines.
- [src/components/ArtistLinks.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/ArtistLinks.jsx>): 46 lines.
- [src/components/Avatar.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/Avatar.jsx>): 14 lines.
- [src/components/Cover.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/Cover.jsx>): 36 lines.
- [src/components/MessageText.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/MessageText.jsx>): 23 lines.
- [src/components/MobileBottomBar.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/MobileBottomBar.jsx>): 107 lines.
- [src/components/modals/AddToPlaylistModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/AddToPlaylistModal.jsx>): 39 lines.
- [src/components/modals/AuthModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/AuthModal.jsx>): 202 lines.
- [src/components/modals/JoinRoomModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/JoinRoomModal.jsx>): 40 lines.
- [src/components/modals/LeaveRoomModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/LeaveRoomModal.jsx>): 64 lines.
- [src/components/modals/MembersModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/MembersModal.jsx>): 188 lines.
- [src/components/modals/ModalShell.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/ModalShell.jsx>): 85 lines.
- [src/components/modals/PasscodeModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/PasscodeModal.jsx>): 46 lines.
- [src/components/modals/PlaylistModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/PlaylistModal.jsx>): 43 lines.
- [src/components/modals/RoomModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/RoomModal.jsx>): 148 lines.
- [src/components/modals/SettingsModal.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/modals/SettingsModal.jsx>): 385 lines.
- [src/components/player/AudioRoot.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/player/AudioRoot.jsx>): 29 lines.
- [src/components/player/FullScreenPlayer.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/player/FullScreenPlayer.jsx>): 267 lines.
- [src/components/player/LyricsPanel.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/player/LyricsPanel.jsx>): 195 lines.
- [src/components/player/PlayerDock.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/player/PlayerDock.jsx>): 176 lines.
- [src/components/player/PreviewEndedCard.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/player/PreviewEndedCard.jsx>): 23 lines.
- [src/components/player/QueueDrawer.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/player/QueueDrawer.jsx>): 124 lines.
- [src/components/SearchOverlay.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/SearchOverlay.jsx>): 340 lines.
- [src/components/shared/AvatarStack.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shared/AvatarStack.jsx>): 14 lines.
- [src/components/shared/MembersContext.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shared/MembersContext.jsx>): 8 lines.
- [src/components/shared/roomRoles.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shared/roomRoles.js>): 8 lines.
- [src/components/shell/Equalizer.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/Equalizer.jsx>): 8 lines.
- [src/components/shell/ErrorBoundary.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/ErrorBoundary.jsx>): 38 lines.
- [src/components/shell/InviteBanner.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/InviteBanner.jsx>): 17 lines.
- [src/components/shell/LazySurface.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/LazySurface.jsx>): 29 lines.
- [src/components/shell/Logo.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/Logo.jsx>): 11 lines.
- [src/components/shell/Sidebar.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/Sidebar.jsx>): 289 lines.
- [src/components/shell/StageBar.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/StageBar.jsx>): 123 lines.
- [src/components/shell/Toast.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/shell/Toast.jsx>): 71 lines.
- [src/components/social/ChatDrawer.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/social/ChatDrawer.jsx>): 614 lines.
- [src/components/social/MessageContextMenu.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/social/MessageContextMenu.jsx>): 116 lines.
- [src/components/social/PublicLoungeDrawer.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/social/PublicLoungeDrawer.jsx>): 520 lines.
- [src/components/social/RoomSocialControls.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/social/RoomSocialControls.jsx>): 15 lines.
- [src/components/social/SocialContext.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/social/SocialContext.jsx>): 4 lines.
- [src/components/social/SongDrop.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/social/SongDrop.jsx>): 16 lines.
- [src/components/TelemetryPill.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/TelemetryPill.jsx>): 37 lines.
- [src/components/TrackCard.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/TrackCard.jsx>): 35 lines.
- [src/components/VoiceNoteBubble.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/components/VoiceNoteBubble.jsx>): 80 lines.
- [src/core/listenerProfile.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/listenerProfile.js>): 340 lines.
- [src/core/lrcParser.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/lrcParser.js>): 118 lines.
- [src/core/moodFeed.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/moodFeed.js>): 49 lines.
- [src/core/queueFilters.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/queueFilters.js>): 17 lines.
- [src/core/roomCommandPolicy.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/roomCommandPolicy.js>): 19 lines.
- [src/core/roomSyncMath.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/roomSyncMath.js>): 31 lines.
- [src/core/roomVotes.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/roomVotes.js>): 12 lines.
- [src/core/searchRanking.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/searchRanking.js>): 164 lines.
- [src/core/sleepTimer.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/sleepTimer.js>): 12 lines.
- [src/core/songDisplay.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/songDisplay.js>): 13 lines.
- [src/core/storageAdapter.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/storageAdapter.js>): 58 lines.
- [src/core/trackIdentity.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/core/trackIdentity.js>): 52 lines.
- [src/hooks/useAppState.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useAppState.js>): 355 lines.
- [src/hooks/useCloudBackend.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useCloudBackend.js>): 109 lines.
- [src/hooks/useDynamicTasteCatalog.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useDynamicTasteCatalog.js>): 85 lines.
- [src/hooks/useEchoSyncController.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useEchoSyncController.js>): 3612 lines.
- [src/hooks/useLiveMoodFeed.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useLiveMoodFeed.js>): 25 lines.
- [src/hooks/useMediaSession.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useMediaSession.js>): 65 lines.
- [src/hooks/useOverlayHistory.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useOverlayHistory.js>): 65 lines.
- [src/hooks/usePlaybackEngine.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/usePlaybackEngine.js>): 2402 lines.
- [src/hooks/usePlaybackState.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/usePlaybackState.js>): 103 lines.
- [src/hooks/useRoomSync.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useRoomSync.js>): 728 lines.
- [src/hooks/useSleepTimer.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useSleepTimer.js>): 37 lines.
- [src/hooks/useSocialFeatures.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useSocialFeatures.js>): 136 lines.
- [src/hooks/useStableActions.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useStableActions.js>): 12 lines.
- [src/hooks/useTrackPalette.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useTrackPalette.js>): 33 lines.
- [src/hooks/useYtHomeFeed.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/hooks/useYtHomeFeed.js>): 75 lines.
- [src/lib/appServices.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/appServices.js>): 2245 lines.
- [src/lib/chat.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/chat.js>): 2 lines.
- [src/lib/media.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/media.js>): 57 lines.
- [src/lib/router.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/router.js>): 89 lines.
- [src/lib/supabaseClient.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/supabaseClient.js>): 22 lines.
- [src/lib/time.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/time.js>): 5 lines.
- [src/lib/voice.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/lib/voice.js>): 35 lines.
- [src/main.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/main.jsx>): 15 lines.
- [src/services/networkMonitor.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/services/networkMonitor.js>): 131 lines.
- [src/services/preloadManager.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/services/preloadManager.js>): 123 lines.
- [src/state/playbackStore.js](</C:/Users/haryw/OneDrive/Desktop/Music App/src/state/playbackStore.js>): 74 lines.
- [src/styles/home-and-shelves.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/home-and-shelves.css>): 2592 lines.
- [src/styles/index.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/index.css>): 11 lines.
- [src/styles/mobile-responsive.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/mobile-responsive.css>): 2707 lines.
- [src/styles/modals-and-toasts.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/modals-and-toasts.css>): 1891 lines.
- [src/styles/player-and-lyrics.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/player-and-lyrics.css>): 2968 lines.
- [src/styles/profiles-and-library.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/profiles-and-library.css>): 2651 lines.
- [src/styles/rooms-and-chat.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/rooms-and-chat.css>): 3778 lines.
- [src/styles/shell-and-nav.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/shell-and-nav.css>): 2410 lines.
- [src/styles/tokens-and-reset.css](</C:/Users/haryw/OneDrive/Desktop/Music App/src/styles/tokens-and-reset.css>): 539 lines.
- [src/views/ArtistProfileView.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/ArtistProfileView.jsx>): 323 lines.
- [src/views/HomeView.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/HomeView.jsx>): 152 lines.
- [src/views/LibraryView.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/LibraryView.jsx>): 355 lines.
- [src/views/RoomsView.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/RoomsView.jsx>): 130 lines.
- [src/views/RoomView.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/RoomView.jsx>): 339 lines.
- [src/views/UserProfileView.jsx](</C:/Users/haryw/OneDrive/Desktop/Music App/src/views/UserProfileView.jsx>): 340 lines.
- [supabase/functions/cleanup-voice-notes/index.ts](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/functions/cleanup-voice-notes/index.ts>): 22 lines.
- [supabase/migrations/20261101142134_ordered_room_commands.sql](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/migrations/20261101142134_ordered_room_commands.sql>): 38 lines.
- [supabase/migrations/20261101145209_heartbeat_position_envelopes.sql](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/migrations/20261101145209_heartbeat_position_envelopes.sql>): 7 lines.
- [supabase/migrations/20261101152859_role_queue_clock_ownership.sql](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/migrations/20261101152859_role_queue_clock_ownership.sql>): 11 lines.
- [supabase/schema.sql](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/schema.sql>): 288 lines.
- [supabase/tests/ordered_room_commands.sql](</C:/Users/haryw/OneDrive/Desktop/Music App/supabase/tests/ordered_room_commands.sql>): 33 lines.
