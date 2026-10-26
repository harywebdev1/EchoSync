# EchoSync mobile-first overhaul — verification

26–27 October 2026 · Baseline: `8c8fff2` · Production promotion: **none**.

## User journeys

- **Home / discovery:** compact guest hero with italic-serif coral accent, one primary listening action, contextual Quick Pick radio, real local-history Continue listening, honest shelf labels, and no repeated sidebar room promotion. First-time guest Quick Picks starts at **y=315px** at 375×812 and 390×844. Recording matching uses normalized title, shared artist credits and compatible known durations; pending seed metadata does not overrule live metadata. Live/remix qualifiers and unrelated artists remain distinct. Existing user IDs survive catalog refreshes.
- **Design system / mobile shell:** neutral charcoal and warm-white surfaces, brand separated from artwork color, opaque dialogs, shared controls/focus/motion tokens, persisted System/Light/Dark preference, safe-area spacing, and larger touch targets. Home rules were moved out of phase-specific sheets into `home.css`; shared patterns live in `patterns.css`. Album images fill their artwork containers.
- **Player / Queue / Lyrics:** fresh empty dock hidden while AudioRoot stays mounted, real active track in the mini-player, focused Player/Lyrics/Queue navigation, Sleep Timer and credits under More, accurate Like/Mute labels, consistent upcoming counts, accessible queue action menus and guarded Undo. Metadata-only Like/queue refreshes preserve the active stream URL. Guest lyrics can load; unavailable/failed lyrics have a visible recovery state. Full-player focus is contained and restored.
- **Search:** recent history appears only when nonempty and is committed on submit/result selection. Local results retain their positions when remote results arrive; counts describe merged rows. Nested Enter/Space actions do not trigger parent playback. Loading, bounded failure, Retry and useful no-results editing are covered.
- **Rooms / Chat / Lounge:** host identity and viewer role are separate, current track says Paused/Now playing, unmeasured or stale drift says Awaiting sync. Audio/YouTube measurement readiness is checked before publishing confident drift. Role no-ops do not produce repeat notices; repeated delivery IDs are filtered and consecutive system notices grouped. Mobile has an explicit Chat entry. Keyboard-height resize keeps Chat open. Diagnostic Duck test was removed; voice failure handling remains real.
- **Library / Auth / Settings:** guest local likes are accessible; mobile playlist detail is focused, with secondary actions in More. Auth has a recognizable Google action and email separator. Mobile Settings uses categories then detail screens; translation is in Audio, crossfade duration is disabled when off, duplicate statistics/Sign out were removed, and lower save controls remain reachable. Settings and local profile saves report storage failures rather than claiming success.

## Application verification

| Verification | Result |
|---|---|
| Production build | PASS; main entry **480.53 KB**, below 500 KB |
| `integrity-unit.cjs` | **22/22**, including active-source protection and artist subset/order, version and unknown-credit identity cases |
| `api-verify.cjs` | **14/14**, controlled upstream contracts |
| `phase3-verify.cjs` | **14/14**, embedded PostgreSQL + simulated remote clients; no new live-cloud claim |
| `integrity-browser.cjs` | **15/15** on production build; >=60s gate, voice failures, AudioRoot, sleep timer, Back, render isolation |
| `guest-audit-verify.cjs` | **23/23** on production build; controlled provider fixtures |
| `phase2-verify.cjs` | PASS: sharing, profile/taste, votes, permissions, visibility, mobile sharing |
| `phase8_1-verify.cjs` | PASS: typography, radio continuation, artwork, Home/Search/Queue/Library/Room |
| `ui-overhaul-verify.cjs` | **12/12** viewport/theme combinations; keyboard actions, counts/history, empty dock, theme, layout, root identity |
| `ui-overhaul-states.cjs` | **12/12**; real local history, empty Rooms, search loading/error/empty, System theme switching |
| `ui-overhaul-journeys.cjs` | **12/12**; Settings categories, Library/playlist, Rooms, Chat, Members, Lounge, login/signup/recovery screenshots |
| `ui-overhaul-mobile.cjs` | PASS: Undo, reachable save, quota feedback, theme persistence, Chat entry and reduced-height composer |
| `p7_5-verify.cjs` | **7/7**; 4× CPU maximum **126 ms**, total **674 ms** |

Existing **750 ms maximum / 3,500 ms total** 4× CPU budgets remain unchanged. The empty-dock persistence test now starts a real song after reload before inspecting saved Repeat/Shuffle preferences. Search/menu/theme selectors were updated for the intended UI; failing provider checks were not replaced by fixtures.

## Visual evidence

All four mobile sizes (360×800, 375×812, 390×844, 430×932) and both desktop sizes (1440×900, 1920×1080) were captured in light and dark themes.

See [complete screenshot index](UI_OVERHAUL_SCREENSHOTS.md) for absolute clickable before/after paths. Before journeys come from an isolated copy of `8c8fff2`; source UI was not modified. Its server allow-list was adjusted solely to serve the original fonts from the shared dependency directory. The old hidden mobile Chat toggle was invoked to document its baseline layout, not counted as a working user journey. The supplied desktop screenshots and GoFullPage captures were inspected; extension overlays/stitching seams were not classified as app bugs.

After screenshots use controlled catalog/audio fixtures. Placeholder artwork in those captures is test data. Real-provider captures are under `performance-results.local/ui-overhaul/live/`.

## External providers and hosted preview

- Real local-production guest playback: **176.23-second stream**, advancing playback, local Like without signup, theme/mobile navigation and stable AudioRoot; **zero uncaught page errors**.
- During that live run, **two discovery API requests returned upstream 502 in the final live run**. Available catalog/fallback playback continued. These are separate from controlled application results.
- Authenticated hosted-preview catalog probe: **5 results, all known >=60 seconds**.
- Authenticated hosted-preview media probe: **206 Partial Content**, **1,024 bytes**, `audio/mp4`, valid `Content-Range` for a real catalog stream.
- Hosted browser automation encountered Vercel login **403**. This is an access gap, not an EchoSync JavaScript crash. The preview retains existing protection and is reviewable by the Vercel owner.
- Automatic approval review rejected creation of an anyone-accessible temporary share link because it broadens access to protected deployment contents. Authenticated HTTP inspection was used instead. No public share link was created.

## Limits and deliberate deferrals

- Mobile viewport/resized-height checks are browser emulation; a physical Android/iOS keyboard, device audio interruption and screen-reader pass remain unverified.
- Existing cloud contracts pass. New live signed-in multi-device, real voice upload and recovery email delivery were not repeated during this UI task. Google provider credentials remain a deployment prerequisite; a button is not a claim that OAuth is configured.
- Cloud signup/recovery UI keeps the application's eight-character minimum; local fallback keeps its existing four-character rule. The live service's full password policy was not re-audited or changed.
- Continue listening uses actual local history. This change does not create durable queue/position restoration across a full reload; a fresh load hides the inactive dock.
- Provider identity matching is conservative when artist credits are missing or durations conflict. It does not merge by title alone or guess whether an unlabelled alternate take is a remix.
- Recommendation explanations / Not interested were deferred: no persisted negative-feedback contract exists. Invite previews were deferred: private-room pre-join data requires an explicit access contract. Installable-app work was deferred: service-worker/offline lifecycle needs separate verification. Optional taste selection remains available without blocking playback.

## Review deployment

Preview: https://echosync-8phjlmasq-dev-haris-projects.vercel.app

Deployment: `dpl_86kQWCAWA4jokZ9AhBbxCurJHw7A` · Target: **Preview** · Status: **READY** · Build: **11 seconds**.

The production reference still resolves to `dpl_BcYm5SievSMfhuePUgMMaa3yUS8U`, verified with authenticated deployment inspection. No production promotion was performed.
