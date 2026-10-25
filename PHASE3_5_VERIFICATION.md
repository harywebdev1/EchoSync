# Phase 3.5 guest audit verification

## Application verification

- Production build: clean; main entry 478.52 KB, below 500 KB. Supabase remains a separate chunk.
- Unit integrity: 21/21. API contracts: 14/14. Cloud contracts: 14/14 (embedded PostgreSQL and simulated remote clients).
- Guest audit: 23/23 across 1440x900 and 390x844, using controlled catalog/audio fixtures. Includes a deliberately failed Auth chunk, successful Retry, and unchanged playing AudioRoot.
- Browser integrity: 15 checks. Responsive Phase 8.1 and Phase 2 social/profile suites verified. Cloud browser checks include PASSWORD_RECOVERY, SDK updateUser and no local password persistence.
- Production fixture regression: 7/7, unchanged limits. 4x CPU: 497 ms maximum task, 2,133 ms cumulative (limits 750/3,500 ms).
- Earlier CPU runs failed cumulative time at 3,646 and 3,526 ms. Offscreen queue-row containment plus memoized unchanged artwork reduced work; no test budgets were relaxed.
- Regression fixtures now declare the long-song duration and acoustic mood metadata explicitly, rather than depending on a particular song surviving an expanded radio pool.
- Desktop/mobile screenshots inspected. Mobile Quick Picks is above the 340 px acceptance threshold, with four full-width rows and explicit paging.

## Implementation and recovery

Guest solo playback, likes and queueing remain local; identity-dependent social/cloud actions retain authentication. Search renders local matches immediately, cancels stale requests and offers Retry after a five-second deadline. Production catalog failover has a 3.2-second primary deadline and 4.8-second overall deadline. Empty/malformed primary results advance to fixed-origin mirrors.

Lazy surfaces use skeletons, idle preloading and a retry boundary. A separate retry module URL avoids the browser's cached failed import without reloading the app or audio. This adds secondary chunks while keeping the entry below budget.

Home uses a 30-song metadata pool and disjoint visible song stems. Unknown duration seeds have no invented stream URLs and still require the existing >=60-second playback confirmation. Recording failures, telemetry and disposable-only storage pruning remain covered by integrity tests.

Supabase Auth now permits recovery redirects to both production domains, preserving existing localhost redirects and all other remote settings. Terms/privacy are concise inline summaries; they are not a substitute for a formally reviewed legal policy.

## External provider / production status

Application commit: 556bbc2. Deployment: dpl_BcYm5SievSMfhuePUgMMaa3yUS8U, https://echosync-gootsgceg-dev-haris-projects.vercel.app (READY).

- https://echosync-social.vercel.app: final live audit 22/22 passed.
- https://echosync-two.vercel.app: final live audit 22/22 passed.
- Both runs used real catalog and full-length audio providers, without catalog/audio fixtures. Guest search rendered playable matches within four seconds on desktop and mobile.
- The second hostname initially reached Vercel login because it was only a manual alias. Registering it as a production project domain restored public access; deployment protection was not disabled.
- Earlier second-domain probes recorded one five-second catalog timeout and one response exceeding four seconds. The final run passed, but upstream latency remains variable; these earlier failures are retained in local logs and are not claimed as an application pass. The audit now continues other application checks after an upstream-probe failure while preserving a nonzero exit status.
- Live feed updates can preserve a carousel song anchor on a later page. The audit uses real Previous controls to establish page 1 before checking all four rows and page navigation.

Controlled tests do not establish continuous upstream availability. Live reset-email testing intercepts the Auth request to verify its method and redirect origin; it does not send email or prove inbox delivery.

Local raw traces, screenshots and logs are under ignored performance-results.local/ and are excluded from deployment. No private credentials are included in this report.
