# Audio and product release verification

Repository: C:/Users/haryw/OneDrive/Desktop/Music App
Base: fa2ce8e on fix/audio-p0. The official player restoration and single AudioRoot are retained.

## Application changes

1. Search merges prefer the songs-filter recording ID, retain alternate IDs, and use title/credited-artist/version matching. This includes label-uploaded music videos whose creator appears in the title instead of the uploader field. Different singers, edits, and materially different durations are excluded.
2. The official API warms in parallel. The initial direct resolver probe is 1,200 ms; its existing bounded native request can complete concurrently. Up to three unblocked alternate IDs are tried. The four-second advancing-clock watchdog starts after the official player is ready; the embed handshake has a separate bounded deadline. Backward seeks reset the watchdog. Terminal errors appear only after usable paths are exhausted. No extractor or stream-proxy implementation was added or extended.
3. Room audio remains connected behind Library, Search and profile navigation. Home from the Room opens Keep Room in Background / Leave Room. Mobile center navigation changes from Lounge to Room Chat and back on explicit leave. The root audio node stays mounted.
4. Room radio does not prefill. Only the clock-owner handling the last ended event requests and appends one related track. The authoritative clock and ordered commands remain intact.
5. Room text and voice sends now have creation timestamps. Own ticks depend on member count and actual peer read receipts. CHAT_READ maps to the existing authenticated typing transport with a receipt flag; no privileged client broadcast or schema bypass was added. Closed-chat messages notify with Open Chat and unread counts. Admin DJ requests support decline from the toast and approval from the bell.
6. Listening/completion awards +3 once, explicit like/playlist/search play awards +5, early skips apply -3 track/-1 artist, and recommendation cycles update every three completed/skipped songs. Home and radio ordering consume the learned weights.
7. Public /playlist/:id pages can display, play and save collections. Share writes public metadata through the existing owner-protected Supabase table before copying the URL; temporary stream URLs are excluded. Artist links preserve ?id= browse identifiers; channel links retain /@username.

## Application gates

- audit:clean: clean, 111 source files checked, no lint fixes needed.
- build: passed. Main entry: 493,801 bytes (493.80 kB), below 500,000 bytes.
- integrity-unit.cjs: 42 checks passed.
- api-verify.cjs: 13 controlled-upstream checks passed.
- integrity-browser.cjs: 41 checks passed, including the final slow-handshake and backward-seek watchdog checks.
- Supabase: live playlist policies inspected. Anonymous/authenticated reads require public visibility or ownership; writes require auth.uid() ownership. No live schema or user-data changes were made.

## Live upstream benchmark

Real Chromium at 390x844 and 1440x900. Real catalog recordings were placed in a local test-account playlist; catalog/media/resolver/official iframe responses were not mocked. Existing natural queue preloading was enabled. This is not twenty isolated cold browser starts. Time-to-first-audio is the first advancing, unmuted, >=60-second media clock; OS audio output was muted, so acoustic output was not measured.

Observed starts: 20/20. Median: 610 ms. Under 1,800 ms: 13/20. Maximum: 13934 ms.

**The universal <1.8-second requirement was NOT achieved.** A successful 20-song sample is not a guarantee of provider availability. Earlier runs included terminal provider failures. ATV IDs can also return embed error 150.

| Width | Requested song | Playing path | ms to media | Terminal errors |
|---|---|---|---:|---|
| 390 | Pehli Dafa | iframe | 12249 | None |
| 390 | Pehli Nazar Mein | audio | 569 | None |
| 390 | Jeene Laga Hoon | audio | 1882 | None |
| 390 | Woh Lamhe Woh Baatein | audio | 2723 | None |
| 390 | Mahi Ve | audio | 6230 | None |
| 390 | Chaleya | audio | 603 | None |
| 390 | Kesariya | audio | 617 | None |
| 390 | Pasoori | audio | 376 | None |
| 390 | Excuses | audio | 2304 | None |
| 390 | Husn | audio | 384 | None |
| 1440 | Pehli Dafa | audio | 3304 | None |
| 1440 | Pehli Nazar Mein | audio | 486 | None |
| 1440 | Jeene Laga Hoon | audio | 501 | None |
| 1440 | Woh Lamhe Woh Baatein | audio | 467 | None |
| 1440 | Mahi Ve | audio | 501 | None |
| 1440 | Chaleya | audio | 482 | None |
| 1440 | Kesariya | audio | 13934 | None |
| 1440 | Pasoori | audio | 1187 | None |
| 1440 | Excuses | audio | 909 | None |
| 1440 | Husn | audio | 591 | None |

Pehli Dafa at 390px recovered from a real primary error 150 into an alternate official iframe. Mahi Ve at 390px and Kesariya at 1440px encountered real embed restrictions and ultimately played native audio. Raw rows and embed failure IDs are in AUDIO_LIVE_RESULTS.json.

## Test assertion changes

- Native fixtures now serve a JavaScript response for the warmed optional official API script rather than executing a JSON fixture as a script.
- Handoff deadline was tightened from the old 3.5-second probe allowance to a 1.2-second probe plus bounded setup allowance.
- Added actual error-150 alternate retry, slow-handshake, and backward-seek watchdog coverage; no duration checks were relaxed.
- Room radio regression now asserts zero requests/prefill before end, exactly one request/append after end, and zero upcoming rows while that appended track plays.
- Taste tests now check the requested +3/+5/-3/-1 values, no duplicate completion award, and three-outcome reranking.
- New browser coverage checks dynamic mobile navigation, background playback, explicit leave, all three tick states, actionable notifications, DJ decline/approve, public playlist routing/play/save, and delayed shell chunks.

## Layout and verification limits

The main shell bounding boxes do not move when Sidebar/PlayerDock chunks are delayed. No shell-attributed layout shifts were measured. Whole-page Home CLS is **not zero**: content/font/feed shifts were also observed (approximately 0.18 mobile and 0.06 desktop in controlled runs). The Obsidian skin, accents and fonts remain intact.

Room convergence tests use isolated browser contexts and controlled transport/player boundaries; physical two-device cloud/audio behavior and mobile OS screen-lock behavior were not certified. Existing comments explain the YouTube mobile-web background limitation and Expo phase 4. Public-playlist routing was tested with a local public collection and live database policy inspection; publishing as a real cloud user was not exercised.

No temporary screenshots are retained. The reusable verification suites and evidence report are intentional repository files. desktop.ini remains untouched and excluded from staging. Production verification is reported separately after deployment.
