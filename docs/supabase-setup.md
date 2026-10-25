# Supabase setup

The quick path takes about three minutes once the Supabase project and Google OAuth credentials exist. No cloud project is modified by the application build.

1. Open Supabase → SQL Editor. Paste and run `supabase/schema.sql`. It creates the four tables, owner/public RLS policies, filtered profile directory, authorized room/message RPCs, private Realtime policies, and the public `voice-notes` bucket. Re-running it is supported. Remove any older permissive policies on these tables/topics before deploying this schema to an existing project; PostgreSQL combines permissive policies with OR.
2. Under Authentication → Providers → Google, enable Google and enter your Google client ID/secret. Add the Supabase callback URL shown there to Google's authorized redirect URIs. In Authentication → URL Configuration, set your production Site URL and allow your development and production origins as redirect URLs. The UI requests `redirectTo: window.location.origin`. Email/password is supported as well; if email confirmation is enabled, users must confirm before their first session exists.
3. Copy the project URL and **public anon key** from Project Settings → API. Copy `.env.example` to `.env.local`, replace the placeholders, and restart Vite. Add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel → Environment Variables, then redeploy: Vite embeds these at build time. Never put a service-role key in any `VITE_` variable.
4. In Realtime Settings, disable **Allow public access**. EchoSync uses private channels even for its global Lounge. Database authorization allows guests to read the public directory/Lounge, signed-in users to publish their own presence, and members to join room topics. Browser clients cannot directly insert broadcast events; `echosync_event` validates identity/role and publishes them server-side. Sensitive room traffic fans out to current members' private inboxes, so cached channel authorization cannot expose later traffic after removal.

Leave both environment variables unset to retain the complete local account/storage/BroadcastChannel experience. Both variables are required; with either one missing the app stays in local mode. Invalid configured credentials show a connection error. Cloud errors are shown visibly. The Google button explains the missing variables in local mode.

## Data and identity

Cloud email/password and Google sessions use Supabase Auth. Passwords never enter profile JSON or local cloud account records. `profiles` is owner-only; `profile_directory` exposes public identity and consent-filtered taste/activity without email or likes. Public playlists are readable; private playlists are owner-only. Private room codes are capability invitations; knowing the correct code permits joining as a Listener, never as a controller.

On first cloud login, the currently active legacy local account/guest likes, playlists and taste are merged into that cloud user. Playlist IDs are namespaced by the cloud UUID and weights/likes are merged without duplication. The migration completion marker is written only after all migration writes succeed. Original local data is retained. Configured cloud sessions, rooms, room clocks, messages, invites and Lounge caches use separate storage keys, preserving the original local-only records. Cloud library hydration applies directly in memory even if the optional local cache is full. Data from a previously signed-in **cloud** user is not migrated to another account. Subsequent logins hydrate from PostgreSQL; session refresh does not restart playback.

The owner library is saved after a short debounce. Remote owner snapshots apply without resetting the audio element; unsaved local edits take precedence until their save finishes. Concurrent ordinary profile/playlist edits use last committed writes. Votes use per-member timestamped operations. The original room wall clock is preserved across devices, and controller role checks happen in PostgreSQL rather than trusting a client `userId` field.

## Voice notes and automatic retention

`voice-notes` is intentionally a **public bucket** as requested: anyone possessing an object URL can play it, including voice notes linked from private room messages. Uploads/deletes are restricted to the authenticated user's UUID folder, audio MIME types, and 10 MB. Recording/upload failures send no message and leave a visible Retry action. Only HTTPS cloud URLs are posted; inline audio remains supported in local mode.

Deploy the included cleanup function with the Supabase CLI:

```sh
supabase functions deploy cleanup-voice-notes
```

The function uses the server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically supplied to Edge Functions. JWT verification remains enabled. When ECHOSYNC_CLEANUP_SECRET is configured as an Edge secret, the caller must also send the matching x-echosync-cleanup-secret header; without that extra configuration it uses its original service-role Authorization check. It selects objects older than 24 hours using `echosync_expired_voice_notes()`, removes the actual bytes with the Storage API, and preserves the chat row as an expiry notice. At most 500 objects are processed per call; schedule more frequently for higher volume. Retention is hourly, so physical expiry occurs between 24 and 25 hours under normal operation.

Enable `pg_cron` and `pg_net` under Database → Extensions. In Vault create `echosync_project_url` (your project URL) and `echosync_cleanup_service_key` (server-only legacy service-role JWT). For a provisioned cleanup secret, also store `echosync_cleanup_secret` in Vault and include it as the `x-echosync-cleanup-secret` header. Schedule the function from the SQL Editor:

```sql
select cron.schedule('echosync-voice-cleanup', '0 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='echosync_project_url') || '/functions/v1/cleanup-voice-notes',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='echosync_cleanup_service_key'),'x-echosync-cleanup-secret',(select decrypted_secret from vault.decrypted_secrets where name='echosync_cleanup_secret')),
    body := '{}'::jsonb
  );
$job$);
```

If rerunning the scheduler setup, first unschedule the existing job by its name. Do not SQL-delete `storage.objects`; that removes metadata without deleting the stored file. The schema leaves cleanup scheduling opt-in because a project URL/function deployment and server secret are required.

## Verification

Run `node phase3-verify.cjs` for embedded PostgreSQL schema/idempotency/RLS tests and two remote client contracts without BroadcastChannel. Run the existing unit, API and production browser suites for local compatibility. `globalThis.__ECHOSYNC_SUPABASE__ = { url, key, client }` is the optional in-memory contract/browser override; production uses the Vite environment variables and dynamically imports the real SDK. A mock test pass does not establish that a specific live Supabase project has been configured correctly.

After deployment, sign in on two separate devices, create/join a room, test Play/Seek/Sync All and a vote, post a song and voice note, refresh each device, and verify private playlists cannot be read by the other account. Check Google redirects on the deployed custom domain and inspect the scheduled cleanup job's run history.

References: [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Auth state changes](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [Storage deletion](https://supabase.com/docs/guides/storage/management/delete-objects).
