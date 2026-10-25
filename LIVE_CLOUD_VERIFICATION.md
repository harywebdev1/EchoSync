# Live cloud provisioning verification

Production: https://echosync-two.vercel.app

## Provisioned resources

- Supabase: echosync, project inhegvkzsqwwepndkuvg, region ap-south-1 (Mumbai), organization Dev Haris. Project created healthy.
- Vercel: dev-haris-projects/echosync. Production deployment dpl_4jmGaXwM3kuKC7VfAbn6jipqqsaH is READY; public production URL returns HTTP 200. Actual deployed main JS is 472,965 bytes, below 500 KB.
- Schema installed: profiles, playlists, rooms and messages all have RLS enabled; filtered profile_directory view exists; all 12 echosync RPC/helper functions exist; 2 Realtime policies and 3 voice object policies exist. Public voice-notes bucket has a 10 MB object limit.
- Public Supabase URL/anon key configured for Vercel production, preview and development, plus ignored .env.local. Deployment and Git exclusions protect local credentials/artifacts. Deployed JS contains only an anon-role JWT, no database password, cleanup secret or service-role JWT.
- Auth Site URL and allowed redirects match production plus localhost/127.0.0.1:5173. Email/password enabled; email confirmation retained.
- cleanup-voice-notes deployed. A dedicated server-only ECHOSYNC_CLEANUP_SECRET resolves the initial exact-service-key authorization mismatch. Gateway JWT verification remains enabled: invalid JWT gets 401; missing cleanup secret gets 401; authorized invocation gets 200 with removed:0. Hourly echosync-voice-cleanup Cron job is active; executing its exact Vault-backed request also returned HTTP 200 with removed:0 and timed_out:false; URL/service credential/cleanup secret are stored in Vault. No aged user objects existed to test physical 24-hour expiry.

## Live application results

- Saavn search: HTTP 200, 5 tracks, durations 281/534/473/481/342 seconds. Media proxy OPTIONS returns 204, disallowed host returns 403, and real ranged audio returns 206 audio/mp4 with bytes 0-1023/11602411.
- Two distinct test accounts authenticated against real Supabase, using independent SDK clients with BroadcastChannel disabled. Private room creation/join, live presence, CLOCK_SYNC, FORCE_RESYNC, queue voting/persistence, Lounge song delivery/history and voice upload/public fetch/private delivery passed. Test accounts were created confirmed for automation; public email delivery was not tested. The uploaded WAV was test-only media, not an application fallback.
- Two isolated production browser contexts signed in through the actual UI and hydrated the persisted private room. From a fresh paused server clock, both played the real 281.856-second track; after the Sync All control, sampled times were 0.300638 and 0.269830 seconds (about 31 ms apart). AudioRoot identity survived navigation in both contexts. Zero uncaught page errors.
- Live privacy: another account cannot read the owner's profiles row; public directory omits email/likes; guests cannot read the private room; a listener cannot send FORCE_RESYNC.
- Focused local checks after the cleanup authorization fix: cloud contracts 14/14, integrity unit 20/20, API contracts 13/13. Previous complete local browser/CPU results remain in PHASE3_VERIFICATION.md; this deployment task added real cloud/browser verification rather than rerunning fixture CPU measurements.

## External/provider and diagnostic status

Initial buffered playback checks encountered stale playing-room clocks and different stream startup delays; a ready-player run showed about 4 seconds of difference before the controlled fresh-clock/Sync All check. No production playback code was changed during provisioning. Final basic browser navigation had zero console errors; the extended successful audio run recorded one browser QUIC_NETWORK_IDLE_TIMEOUT console message with no HTTP error responses. Earlier attempts also saw intermittent Invidious CORS failures and missing lyrics (404); these are not represented as cloud Auth/RLS/Realtime failures. Google OAuth is not tested because its provider is disabled.

The hosted security advisor is not clean: it flags the deliberately owner-readable filtered profile_directory as security_definer_view, plus callable definer helpers/RPCs. The directory projection intentionally bypasses owner-row isolation to expose only consent-filtered public fields; live checks confirmed private profile rows, email and likes remain hidden. This retained architectural exception is documented rather than silently reported as a zero-advisory result.

## Remaining manual step

Configure a Google OAuth web client and enable the Supabase Google provider with its Client ID/Secret. Use https://inhegvkzsqwwepndkuvg.supabase.co/auth/v1/callback as the authorized callback and the production site as an allowed origin. The app's Site URL/redirect allowlist is already configured. Enter credentials in provider dashboards, not Git or chat.

Evidence is retained privately under performance-results.local/cloud/, including live-session-1.png, live-session-2.png and live-playing.png. The public Lounge smoke-test card was removed through its author account. The two synthetic smoke accounts/private test room are retained for reproducibility; their credentials are only in ignored local provisioning state.
