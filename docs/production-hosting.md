# Production hosting

Import this repository into Vercel as a Vite project. The checked-in vercel.json specifies npm run build, the dist output directory, function timeouts, and rewrites. Use a supported Node.js runtime (22.x or 24.x). Add the custom domain and its DNS records in the Vercel project settings; this code change does not deploy or configure DNS.

## Routes

| Request | Behavior |
| --- | --- |
| GET /api/youtube/audio/:videoId | Rewrites to /api/youtube-audio?videoId=:videoId. Requires an 11-character YouTube ID. Returns URL, duration, MIME type, bitrate, title, author and thumbnail. |
| GET /api/youtube-audio?videoId=:videoId | Direct serverless resolver endpoint. |
| GET or HEAD /api/media?url=:encodedUrl | Proxies an allowed HTTPS media/artwork URL, preserving upstream status and seeking headers. |
| OPTIONS /api/media | Range/CORS preflight. |
| /library and other client paths | SPA fallback to index.html. API and built asset paths are excluded from this fallback. |

The browser uses the same-origin resolver and media proxy in production. Vite development and preview mount the same shared handlers from server/, so there is one implementation to maintain. youtubei.js is a production dependency, loaded lazily on the server.

The proxy validates the target and each redirect against an explicit host allowlist, rejects credentials/nonstandard ports, bounds audio requests to 1 MiB and artwork responses to 4 MiB, forwards valid single byte ranges, awaits streaming completion, and aborts on timeout or client disconnect. An upstream that ignores ranges and returns an oversized file is rejected rather than downloading the entire song. Signed stream URLs remain short-lived upstream resources.

Media request errors use 400 (invalid URL), 403 (disallowed target), 405 (method), 416 (unsupported range), 502 (upstream failure), or 504 (deadline). Actual upstream errors such as 403/410 are retained for the player's recovery path. Resolver failures return a sanitized 502 JSON response. Resolver caches are bounded, warm-instance optimizations; cold functions resolve again.

## Local verification

Run npm run build, node integrity-unit.cjs and node api-verify.cjs. The API suite starts local HTTP servers and supplies controlled upstream responses; it does not depend on provider availability.

With npm run dev running, node integrity-browser.cjs verifies application behavior, audio continuity, OS media controls and room messages. Set ECHOSYNC_FIXTURE=1 before node p7_5-verify.cjs for the fixture regression suite. For a production-bundle run, use npm run preview and ECHOSYNC_URL=http://127.0.0.1:4173 for the browser scripts.

Vite preview exercises the shared Node handlers but is not an emulator of Vercel's deployment router. A deployed smoke check should confirm deep links, the resolver rewrite, actual provider response/range headers, and seeking. Fixture success does not establish live-provider availability; upstream services may reject datacenter requests or expire signed URLs.

References: [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel function limits](https://vercel.com/docs/functions/limitations).
