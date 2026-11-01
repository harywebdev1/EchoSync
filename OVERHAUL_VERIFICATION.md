# EchoSync overhaul verification — 2026-11-01

## Application verification

- `npm run audit:clean`: PASS; no Knip findings or Biome errors.
- `npm run build`: PASS; main entry **495.59 KB**, gzip **158.40 KB**.
- `node integrity-unit.cjs`: **38/38 PASS**.
- `node api-verify.cjs`: **13/13 PASS**, using controlled upstream responses.
- Production-preview full browser regression: **23/23 PASS**. After the final role/queue heartbeat-ownership adjustment, all four overhaul checks passed again against the rebuilt production output.
- Development: all three geometry cases passed; the final focused two-context sync check passed after making remote Pause stop audio before React renders.
- Rendered checks at **1440×900, 390×844, 360×780** cover adjacent 56px rows, artist lines at most 24px high, both multi-artist examples, artist/user navigation, duplicate album suppression, horizontal overflow, mobile player tabs and persistent root audio identity.
- Existing regression coverage retains real microphone-byte recording, denied-microphone Retry behavior, storage recovery, queue operations, Media Session, overlay Back dismissal and the 30-second guest preview.

## Room sync evidence and limits

- Isolated Admin/Member browser contexts relay the application's real BroadcastChannel messages through a test-only bridge; no transport state is mocked inside application code.
- Final production-focused run: promotion **137 ms**, promoted-DJ Pause **72 ms**, measured from browser input events to peer UI/audio events. Earlier full production run: **30 ms / 27 ms**.
- Final development run: promotion **280 ms**, Pause **321 ms**. Both meet the requested **500 ms verification gate**. The aspirational 200 ms promotion target is not consistently met in development or guaranteed over the public network.
- Pause/Play/Next converge; replayed older Play is rejected; an 11-second observation spans the heartbeat interval without periodic hard seeks or track reversion. A one-second drift produces 1.03× playback then resets to 1× without seeking.
- Three additive migrations applied to the existing Supabase project preserve existing membership authorization and unrelated room policies. Real authenticated RPC transaction checks pass for DJ promotion, heartbeat ownership, Pause, stale heartbeat rejection, track change and position-only heartbeat envelopes. All QA identities, rooms and broadcasts are rolled back.
- This is separate browser-transport and database-RPC verification, **not a measured two-device public-network end-to-end latency guarantee**. Existing Supabase security advisories were observed and were not silently reconfigured as part of this layout/sync task.

## Scroll and visual evidence

- Existing #030303 canvas, fonts, song-accent tokens and fixed glass chrome are preserved. Repeating content blur is removed; ambient glow is static and isolated; rows/cards use containment.
- Normal-CPU mobile scroll sample: **16.8 ms p95** frame interval across 89 intervals, approximately a 60 Hz cadence.
- 4× CPU production samples: **33.2–33.4 ms p95**; observed longest tasks ranged **0–117 ms** across the focused/full runs. A development sample recorded **361 ms**. These are browser observations, not a universal 60 FPS guarantee under CPU throttling.
- Desktop and mobile Room/player screenshots were inspected. Temporary screenshots were removed before commit; permanent regression scripts and database tests remain.

## External provider status

- Pre-release public smoke: application HTTP **200**; live YouTube catalog search for `Chaleya` HTTP **200**, **3 results**.
- API contract tests use controlled providers and do not establish live stream reliability. Catalog availability does not prove every provider audio URL resolves or plays; no universal upstream-success claim is made.
- Production deployment and final public smoke results are reported in the completion message.
