# Pre-Phase 8.0 integrity patch

Scope: the five agreed integrity fixes only. No modular split, production API routes, or cloud backend changes.

## Application verification

- `npm run build`: passed. The existing >500 KB JavaScript chunk warning remains (about 522 KB).
- `node integrity-unit.cjs`: 6 checks passed. Covers catalog duration boundaries, metadata-gated playback and stale attempts, RTT jitter and drift boundaries, safe cache pruning/retry/failure notification, and both recording handlers' denial/error/empty-data/retry paths.
- `node integrity-browser.cjs`: 6 checks passed. Covers real media metadata blocking, unknown-duration playback at exactly 60 seconds, visible storage failure and preservation of user content, storage unavailable at startup, and denied microphone followed by a successful test-device recording in both chat views.
- Updated seven-case regression suite with controlled fixtures: **5 passed, 2 failed**. Passed HTTP 410 recovery (1,303 ms in the final suite run), AbortError reconciliation, repeat/shuffle/queue persistence, tablet layout, and modal accessibility.

Remaining regression failures are deliberately not suppressed:

1. Mobile typography: an existing numeric badge renders at 8px, below the suite's 9px minimum. The committed baseline also fails this assertion.
2. CPU budget: the final run measured a 2,594 ms task at 4x CPU throttling, exceeding the existing 750 ms limit. A separate committed-baseline run also failed (1,648 ms). These environment-sensitive measurements do not establish performance parity or the size of a regression; further profiling remains necessary.

These failures are outside the five integrity fixes. The full regression suite is **not green**. The temporary baseline snapshot/server was removed after comparison.

## Live providers and upstream limitations

A separate live-provider run started playback and resumed it. Its browser did not consume the injected HTTP 410, so that run does **not** verify expired-stream recovery. The test now reports this as `TEST_SETUP_FAULT_NOT_EXERCISED`, separately from application failures. Network-dependent playback timeouts include media state and observed provider HTTP/request failures; aborted browser requests are excluded from upstream-failure evidence. Provider failure evidence does not by itself prove the sole cause of a timeout.

The controlled fixtures exercise real browser audio loading, ranges, decoding, and playback, but do not establish live catalog/provider availability. Generated audio and fake microphone devices exist only in test files.

## Reproduction (PowerShell)

Start the app with `npm run dev` in another terminal, then run:

```powershell
node integrity-unit.cjs
node integrity-browser.cjs
$env:ECHOSYNC_FIXTURE = '1'
node p7_5-verify.cjs
Remove-Item Env:ECHOSYNC_FIXTURE
```

Set `CHROME_PATH` to an installed Chromium executable if the default local path differs. `ECHOSYNC_URL` overrides the default `http://127.0.0.1:5173`. Fixture tests create isolated browser contexts and do not use personal browser data. The legacy live regression mode requires an authenticated Playwright storage-state file via `ECHOSYNC_STATE`. Optional `ECHOSYNC_CASE` selects cases whose name contains the supplied text.
