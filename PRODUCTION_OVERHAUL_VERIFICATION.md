# EchoSync production overhaul — verification

Verified 4–5 November 2026 (Asia/Karachi). Baseline: `688033e`.

## Application verification results

| Check | Result |
|---|---|
| `npm run audit:clean` | PASS — no Knip findings or Biome errors |
| `npm run build` | PASS — main entry **498,781 bytes**, below 500,000 bytes |
| `node integrity-unit.cjs` | PASS — **40 checks** |
| `node api-verify.cjs` | PASS — **13 controlled-upstream checks**, including album browse |
| Development browser regression | PASS — 29-check regression, plus the new Room-radio case separately |
| Final production browser regression | PASS — **30 checks** |
| Viewports | **360×780, 390×844, 1440×900** |
| Controlled startup catalog requests | **2**, including a test that enforces the maximum of 3 |

The production entry is `index-BuOYmdcb.js`, SHA-256:
`03e2ca9b76bcbf8f42dc70a888810006ab7f983ad11161612533df44f0efe8f8`.

### Audio and playback

- The persistent `AudioRoot` remains the same DOM node during navigation, drawers, profile visits and queue changes. The hidden YouTube player, its API loader, polling and obsolete refs/styles were removed.
- Next-track resolution begins when playback starts. Only metadata-confirmed media of at least 60 seconds enters the synchronous handoff cache; expired/failed entries are discarded.
- The native `ended` test confirms that the exact next URL is assigned and `play()` is invoked while the browser is handling the actual `ended` event. It also waits for the next track's audio clock to advance.
- Media Session metadata, 96/512 artwork declarations, play/pause/previous/next and all three seek actions are wired. Position includes the native playback rate and is refreshed periodically and during playback events.
- Paused Room Resync remains paused. Room radio appends catalog recommendations before exhaustion, advances playback, and changes the upcoming count from 2 to 1.
- Known short media is blocked even when catalog metadata claims a full song. Unknown catalog durations remain selectable and are checked against the actual media.

### Layout, collections and notifications

- Visible Quick Picks rows measure **56px**. The action rail is 4px from the row edge on both mobile viewports, and aligned on desktop.
- A 26-track upcoming queue scrolls to its final row. Library New playlist remains wider than 90px; playlist secondary actions live under More.
- Room queue headings/actions, saved-room count, Chat & Voice access and near-opaque bottom-reaching chat sheets were corrected. Sign out is in normal modal flow.
- Album cards open a proper tracklist sheet with Play Album and Shuffle. Album/import sheets render outside clipped view containers while inheriting the app theme.
- Playlist and Liked playback use their respective collections. Missing liked IDs and saved preview metadata are retained for later full-stream hydration.
- Unearned verification badges and duplicate drift wording were removed; artist sharing preserves the browse ID.
- Structured 3.5-second toast cards use one viewport. The header bell retains the latest 15 notifications, supports unread state/Clear all, and invitation actions work.
- Dark `#030303`, existing fonts and dynamic song accents are preserved. Visual captures were reviewed and temporary screenshots removed.

## Live Lounge retention

Applied migrations:

- `20261104165237_public_lounge_expiry.sql`
- `20261104202458_lounge_voice_retention.sql`

The client, local persistence and cloud history enforce the 24-hour cutoff. Client pruning runs every 60 seconds. Database post/fetch cleanup and minute-based expiry jobs are active.

The existing Storage API worker now runs every minute. Its candidate query protects every file still referenced by a Room message. The job ran successfully and its HTTP response was `200 {"removed":0}`. The database post-cleanup test left zero expired Lounge rows; anonymous callers cannot execute the prune RPC. No physical test recording was inserted into production.

## External provider status and verification limits

- **Live YouTube audio availability is unverified.** The live resolver smoke-test command was declined, so controlled route fixtures are not presented as proof of upstream streaming success.
- The resolver races mobile MP4 formats with a 3.5-second deadline and avoids player-JavaScript bootstrap. It requires a real direct format URL; cipher-only, attestation, regional or provider failures return an honest error. There is no iframe or synthetic-audio fallback.
- **Physical Android/iOS screen lock is unverified.** Headless and minimized-window probes continued to report a visible page. The native-event handoff test proves the implemented execution path, not real OS background suspension behavior. The unsuccessful visibility probe is not counted as a pass.
- Two isolated browser contexts verified role promotion, transport ordering, stale-command rejection and convergence. This is not a public-network, physical-two-device guarantee.
- Existing broader Supabase advisor findings were not treated as cleared by this frontend/audio release.

## Release

Authorized destination: `origin/main` and <https://echosync-social.vercel.app>.

Release commit message:
`feat(production-overhaul): background/lock-screen audio, 24h lounge expiry, structured notifications, and full audit UI/sync fixes`

The completion message records the actual release commit and deployment result. The pre-change forensic report remains in `FULL_PRODUCT_AND_CODE_AUDIT.md` as baseline evidence. Pre-existing `desktop.ini` is left untouched and excluded from the release commit.
