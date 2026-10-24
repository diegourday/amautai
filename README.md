# Amautai

<img src="apps/web/public/favicon.svg" alt="Amautai" width="48" />

Amautai is a multilingual math-learning platform for primary-school teachers and families. The repository includes WorkOS authentication, teacher/parent onboarding, persisted second-grade Mathematics session drafts, five learning games, named game rooms, a tenant-scoped project workspace, and email/WhatsApp notification settings. The interface supports Spanish, Chanka Quechua, and Peruvian Aymara; linguistic review and measured learning outcomes remain pending.

Mail transition (October 18, 2026): Stalwart domain `amautai.turistivo.com` and mailbox `notificaciones@amautai.turistivo.com` is created and authenticates Stalwart. The active sender is `amautai@turistivo.com`, an alias on the existing `turistivo.com` mail domain; `soporte@amautai.turistivo.com` and `postmaster@amautai.turistivo.com` remain aliases on the new domain. MX, SPF and DMARC for `turistivo.com` are published. The Worker uses the sender through four EMAIL_* secrets; a generic sender test and a real WorkOS password-reset email were delivered to the owner’s Outlook inbox from `amautai@turistivo.com`. The Worker JMAP secrets were corrected and the recovery flow now succeeds. The previous mailbox is retained. WorkOS Admin Portal invitations now use this address as their reply-to; Amautai verification/reset emails use it as the sender. WorkOS-hosted Magic Auth emails still use WorkOS delivery.

The public `/privacidad` and `/terminos` pages took effect on October 18, 2026. Amautai is operated by Diego Urday as an individual; privacy and account requests go to `amautai@turistivo.com`. The published legal text is Spanish; Quechua and Aymara legal translations still need human review. Google OAuth uses Amautai's own client credentials in WorkOS Andes Staging. Google consent-screen publishing and WorkOS Production are still pending; WorkOS requires billing information to enable Production, and Google currently labels the app Testing.

Development handoff: [messaging architecture, WhatsApp and email](docs/MESSAGING_HANDOFF.md).

The production configuration targets one Amautai Worker and its D1 database in the Turistivo Cloudflare account. The canonical domain binds directly to that Worker; the app does not proxy to `amautai.urday.dev`. See [project status](PROJECT_STATUS.md) for verified behavior and remaining work.

The last documented public release includes teacher onboarding and persisted second-grade Mathematics session drafts. The integrated onboarding and games were checked locally; merging or pushing this code does not deploy it. See [project status](PROJECT_STATUS.md) and [teacher onboarding and session drafts](docs/TEACHER_ONBOARDING.md).

The public `/lista-de-espera` page lists respondent names from the family and teacher surveys in separate columns. It does not show phone numbers or survey answers. The names are a snapshot and are not synchronized automatically. See [survey method and results](docs/PROBLEM_VALIDATION_SURVEYS.md).

Teachers can now register a student's name with their **father, mother, or guardian's phone number** and assign the room's game through WhatsApp. The personal link opens a student-only activity without a teacher login and saves progress in the teacher's room. This local change requires migration 0016 and a connected gateway before production delivery. See [student assignments](docs/STUDENT_ASSIGNMENTS.md) for delivery states, access boundaries, and verification.

## Profiles and games

- The public landing page uses a mobile drawer for navigation, language, theme, and account actions. The interface defaults to light theme until the user chooses another theme.
- After sign-in, users choose a teacher or parent profile at `/registro/perfil`; its Amautai wordmark returns to `/`. The profile step accepts nine Peruvian mobile digits, prepends `+51`, and registers the number for an automatic WhatsApp welcome; notification preferences are managed under Notifications. Family registration requires a primary grade, city, and main language. Registration uses its own loading layout; `/panel` uses the shared shadcn sidebar. See [profile onboarding](docs/PROFILE_ONBOARDING.md).
- Teacher rooms at `/panel/salas` support names, participant scores, deletion, and five games: food-group multiplication, [market addition/subtraction](docs/MARKET_GAME.md) with always-visible direction controls above the collect/deliver actions, [nursery units/tens](docs/NURSERY_GAME.md), [equality fair](docs/FAIR_GAME.md), and [builders geometry](docs/BUILDER_GAME.md).
- Parents use `/panel` to manage multiple child aliases and create private practice sessions using the same five teacher games. Each child has an explicit regional context, saved scores and resumable sessions. See [family games](docs/FAMILY_GAMES.md).
- Existing profile and game migration filenames are retained, including their shared numeric prefixes. Wrangler tracks full filenames; the standard migration command below applies only pending files.

## Hack the Andes submission

- [Live application](https://amautai.turistivo.com/)
- [Presentation](https://docs.google.com/presentation/d/1TMAc5OI7j3k6nmsJtoPF6GwafxPQO7O2moXpUfIuFiM/edit?usp=sharing)
- [Public GitHub repository](https://github.com/turistivo/amautai)
- [Project description](HACKATHON_SUBMISSION.md): problem, audience, implementation, survey evidence, and current limitations, written in English.

The [official submission guide](https://hacktheandes.com/guide) accepts the Markdown description through the Andes CLI's `--file` option, alongside the deployment, presentation, and GitHub URLs. Submit from WSL with `andes project submit` and those four inputs; inspect the saved submission with `andes project`.

The latest documented public release supports teacher onboarding and Grade 2 session drafts. Integrated games, family practice, and student WhatsApp assignments have local implementation evidence; verify the deployed flows before claiming production availability. Survey responses document the problem, not product adoption or learning gains.

## Stack

React, Vite, TypeScript, shadcn/ui (Base UI), Tailwind CSS, Motion, native fetch, Hono, Cloudflare Workers, D1, WorkOS, and Zod. pnpm workspaces and Turborepo manage the monorepo.

- `apps/web`: React routes, onboarding, authentication, game runtime, and workspace UI.
- `apps/worker`: Hono API, WorkOS integration, session validation, notifications, and D1 migrations.
- `packages/ui`: shared components and theme.
- `packages/contracts`: shared Zod schemas and TypeScript contracts used by the web app and API.

## Current environment

Local development uses the dedicated WorkOS environment currently labeled **Andes Staging**. Its application has been renamed to **Amautai**; the existing IDs, users, credentials, and redirects are preserved:

| Setting | Value |
| --- | --- |
| Environment ID | `environment_01M55794FEVPYABA9SQKHV09MJ` |
| Application | Amautai |
| Application ID | `app_01M557951EG96SCAYXZT38RF7D` |
| Client ID | `client_01M55794X1B33VNMX8PW0JEYQ9` |
| Trusted issuer | `https://api.workos.com/user_management/client_01M55794X1B33VNMX8PW0JEYQ9` |
| Custom audience | None; this environment does not inherit the Walpia JWT template |
| Local login | http://localhost:5173/iniciar-sesion |
| Local signup | http://localhost:5173/crear-cuenta |
| OAuth callbacks | `https://amautai.turistivo.com/callback` (default), `http://localhost:5173/callback` |
| Password reset entry | `https://amautai.turistivo.com/api/auth/password-reset/start` |
| Public login / signup | https://amautai.turistivo.com/iniciar-sesion / https://amautai.turistivo.com/crear-cuenta |

The isolated environment was created on October 17, 2026 with no users. The original user and Turistivo membership remain in the shared WorkOS environment. Signing up here creates a separate account, even when using the same email.

Amautai is deployed at https://amautai.turistivo.com using the dedicated WorkOS environment above. The older demo at https://andes.urday.dev remains on the previous Worker and shared environment; it is not modified by this deployment.

## Local development in WSL

Requirements: Node.js 22 LTS and pnpm 11.25.0.

```bash
cd /home/diegourday/code/amautai
pnpm install
# Configure apps/worker/.dev.vars with the server secrets below.
pnpm --filter @amautai/worker exec wrangler d1 migrations apply andes-app-db --local
pnpm exec turbo dev --filter=web --filter=@amautai/worker --ui=stream
```

The Worker development command applies pending **local** D1 migrations before starting. After pulling changes while an older Worker is still running, restart it or run the migration command above; no remote migrations run automatically.

Vite runs at port 5173 and proxies `/api/*` and `/callback` to the Worker at port 8787. Both processes must be running. The Worker uses an explicit local upstream to preserve the origin used for CSRF and cookie handling.

The filtered command starts the web app and Worker without the standalone WhatsApp gateway, which has separate runtime configuration. Root `pnpm run dev` includes the gateway too.

Earlier sessions used the transient WSL user service `amautai-dev.service`. If that service exists, inspect or stop it before starting another instance:

```bash
systemctl --user status amautai-dev
systemctl --user restart amautai-dev
systemctl --user stop amautai-dev
```

The transient service is not enabled at boot and may no longer exist. Port 8788 is an optional built-assets preview; authentication in the isolated environment is configured for 5173.

### Server configuration

Public server configuration is in `apps/worker/wrangler.jsonc`: WorkOS Client ID, exact token issuer, `AUTH_EMAIL_MODE=custom`, allowed app origins, and the D1 binding. An optional `WORKOS_TOKEN_AUDIENCE` must be validated independently from the Client ID when the environment uses a custom audience. Local development needs protected `EMAIL_*` configuration for authentication mail because WorkOS verification and reset delivery are disabled in this environment.

Server secrets belong only in the Git-ignored `apps/worker/.dev.vars`:

```dotenv
WORKOS_API_KEY=<dedicated Andes Staging API key>
WORKOS_COOKIE_PASSWORD=<random secret of at least 32 characters>
```

The isolated server key is also stored as a Cloudflare Worker secret for the public deployment and expires on October 24, 2026. Rotate it before expiration. No secret uses a `VITE_` variable. The browser does not need WorkOS environment variables.

The previous local credentials are preserved in the ignored `.dev.vars.shared` file for checking the original account. They are not used by the local app. The local cookie secret was rotated during separation, invalidating cookies from the shared environment.

## Authentication

The login, signup, email verification, and password recovery screens live inside Amautai. Google and GitHub use direct OAuth provider authorization through WorkOS; after authorization the browser returns to the app. Google uses Amautai's own OAuth client credentials in Andes Staging; GitHub still uses demo credentials. Google's consent screen remains in Testing, and WorkOS Production is not enabled.

Email signup collects a name, email, and password of at least 12 characters. WorkOS enforces its password policy and issues verification challenges when required. With `AUTH_EMAIL_MODE=custom`, Amautai delivers verification codes through Stalwart; WorkOS still validates them. Both password authentication and OAuth callbacks handle these challenges inside the app. Pending verification tokens stay in encrypted HttpOnly cookies for ten minutes. Users enter the six-digit code at `/verificar-correo` with the accessible OTP input.

Password recovery starts at `/recuperar-contrasena`. The email link enters a server endpoint that exchanges the URL token for an encrypted HttpOnly cookie and opens a clean `/restablecer-contrasena` URL. Successful password changes return to login. WorkOS revokes the account's existing sessions. Unknown and registered email addresses receive the same request confirmation; configuration and network failures are not reported as successful sends.

OAuth uses PKCE, encrypted short-lived state, and explicit origin validation. Sealed session cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS. The server verifies signature, issuer, expiry, session, and exact application Client ID. WorkOS handles token refresh. Sign-out revokes the session and clears the app cookie. Repeated sign-out with an expired session also clears the cookie. Revocation failures keep the current page and offer a retry in the user menu. The WorkOS client and its signing-key cache are reused between requests; exact application and issuer checks remain enforced. Mutations require an allowed Origin and a custom request header.

Diagnostics include only error categories, operation, and status. Cookies, tokens, submitted passwords, and user details are excluded. Network/service failures return 503, rate limits 429, and rejected credentials 401. Recovery service errors do not mark a valid email field invalid.

Custom MFA challenges, organization selection, SSO-required continuations, and organization administration are not implemented. Do not require those flows before adding the corresponding UI and server handling.

## Data and projects

D1 stores tenants and projects. The server derives the tenant from the verified WorkOS organization or user, never from request input. Existing D1 data is preserved during authentication separation; users from the new environment have distinct identities.

Projects support create, list, detail, edit, and soft delete. Zod validates name (3–100 characters), description (up to 1,000), and status (idea, building, ready). Prepared statements always filter by tenant. Version checks reject stale edits or deletes with 409. Lists currently show at most 100 active projects.

`GET /api/health` queries D1. `GET /api/auth/session` validates the session and initializes its tenant. CRUD endpoints live under `/api/projects`.

## Interface

Preset `b7Br6guwa`: Maia, Base UI, blue theme, Inter, and Lucide. Official `sidebar-08` and `login-02` blocks provide the foundation. The login uses a generated Andean mountain image and an SVG mountain mark.

Light mode is the default. The dashboard toggle and D shortcut outside text fields change the persisted theme.

Account shows the signed-in user's name and email as read-only fields, with a password recovery link. Settings shows the workspace, a persisted light/dark/system preference, and a live database health check with retry. Unknown routes display a 404 with a way back to the dashboard. Project loading uses skeletons. Route and session loading preserve the responsive login or dashboard layout with branded placeholders and screen-reader status messages. Skeleton motion respects reduced-motion preferences, and session checks time out after 15 seconds with a retryable error. Authentication and dashboard screens are loaded separately. The latest route/session loading refinements were included in the notifications deployment.

Recovery screens remain accessible to signed-in users. After a successful password reset, the browser reloads its session state before returning to login.

## Validation

```bash
pnpm run check
```

Build compiles the frontend and bundles the Worker with `--dry-run`; it does not publish anything. Tests cover token validation, cross-environment rejection, registration, verification, recovery, network failures, CRUD, tenant isolation, and stale writes.

The integrated code passed `pnpm run check` on October 18, 2026: 11 architecture tests, 98 backend tests, 29 frontend tests, and 4 gateway tests, plus lint, typechecking, and the production build. Game tests cover scoring, room persistence, inventory, and movement rules. These checks do not establish production deployment or measured learning gains.

On October 17, 2026, the user completed signup, email verification, password recovery, and password login in the isolated Andes Staging environment. Server responses confirmed password reset and login succeeded, with an unauthorized session after reset until the user signed in again.

Browser checks confirmed Account displays the signed-in user, Settings reports the database available, logout succeeds and returns to login, and directly opening the protected projects route after logout redirects to login. The earlier signing-key timeout was addressed by reusing the SDK client and key cache. Evidence is saved locally in the ignored .artifacts directory.

Before the architecture migration, 38 backend tests, type checking, lint, and the frontend/Worker dry-run build passed. That migration checkpoint included 41 backend tests, 3 frontend transport tests, and 7 architecture-checker tests. Automated tests cover logout revocation, retry after upstream failure, idempotent logout for expired sessions, origin enforcement, and WorkOS client cache isolation in addition to the authentication and CRUD cases above.

## Deployment status

Worker: `amautai`. Canonical domain: https://amautai.turistivo.com. D1: `andes-app-db`. The current configuration targets the Turistivo Cloudflare account (`49d9cc4a3f40d7228ed3593263d35588`) and binds the domain directly to the Worker. The former personal-account deployment at `amautai.urday.dev` is historical.

The initial deployment completed on October 17, 2026, with version `7dc1712b-286e-48f6-8ddc-400f4b334933`; the Worker later moved to the Turistivo account. Both local and public origins are allowed. WorkOS uses the public callback by default and keeps the local callback registered. Login, signup, sign-out, and password recovery use the public domain. WorkOS has a single password reset URL per application: recovery emails requested locally open the public app.

The public Worker has its own cookie encryption secret. Its WorkOS API key stays server-side. Secrets are provisioned separately from deployment configuration and never committed.

To publish after reviewing this README, run `wrangler whoami` and confirm the Turistivo account before applying remote migrations or deploying:

```bash
pnpm --filter @amautai/worker exec wrangler whoami
pnpm run check
pnpm --filter @amautai/worker exec wrangler d1 migrations apply andes-app-db --remote
pnpm --filter @amautai/worker exec wrangler deploy
```

HTTPS and public assets return 200. The health endpoint reports D1 connected. Anonymous session and projects requests return 401. Google and GitHub authorization URLs use the new public callback, exact Client ID, and encrypted Secure/HttpOnly OAuth state cookies. Public password login and logout were verified in the browser on October 17, 2026: the signed-in user and saved project persisted after reload, Settings reported the database available, logout returned to login, and opening the protected projects route after logout redirected to login. A successful deployment is not a GitHub backup.

## Project rename

The project folder, package names, app branding, authentication cookie names, request header, theme storage, and local service use Amautai. The local service is amautai-dev.service and the project lives at /home/diegourday/code/amautai. Existing local database files, credentials, and Git history were preserved. The cookie namespace changed, so sign in again after the rename.

Hack the Andes remains the event name. The existing D1 database name is an infrastructure reference and remains unchanged to preserve data. Amautai uses its new domain and separate Worker; the old domain and Worker are retained. Worker secrets are configured separately.

The public repository belongs to the Turistivo organization: https://github.com/turistivo/amautai. Anyone can read the source; Diego and Erik are organization admins. Check Git status and upstream parity separately from deployment.

## Project architecture skills

Architecture guidance is local to this repository, not installed globally:

- [Backend](.agents/skills/amautai-backend/SKILL.md): lightweight Clean Architecture, inward dependency rules, tenant-safe persistence, WorkOS adapters, and testable use cases.
- [Frontend](.agents/skills/amautai-frontend/SKILL.md): feature ownership, typed API/hooks/UI boundaries, accessible async behavior, and a separate future Phaser runtime.
- [Rubric](docs/HACKATHON_RUBRIC.md): evaluation requirements, scoring, delivery gaps, and links to the preserved source.

Root AGENTS.md requires reading the relevant skill and rubric. The existing scaffold has been migrated locally to these boundaries. See [architecture and automated gates](docs/ARCHITECTURE.md). The architecture refactor was included in the notifications deployment on October 17, 2026.

## Optional services

R2, Workers AI or MiniMax, Vectorize, Durable Objects/WebSockets, and Containers remain optional and are not enabled.

### Remembered room options (Atomic Memory, optional)

The new-room form in **Salas de juego** can remember one set of options per teacher: game, mode and game context. Nothing is remembered until the teacher selects **Recordar opciones actuales**. Remembered options are applied only when the teacher selects **Usar opciones recordadas**, so an edited form is never overwritten. **Olvidar** removes them. Room names, student names and guardian phones are never sent.

The feature is off unless all three settings are present. Without them the panel is hidden and room creation is unchanged:

```dotenv
ROOM_PRESET_MEMORY_ENABLED=true
ATOMICMEMORY_API_URL=https://<atomic-memory-host>
ATOMICMEMORY_API_KEY=<server-only key>  # Worker secret; never a VITE_ variable
```

The API URL must use HTTPS. Plain HTTP is accepted only for loopback test fixtures. The Worker stores the preset with verbatim quick ingest (`content_class: summary`). It is stored under a `user_id` derived from the verified tenant and user, with a stable `metadata.externalId` derived from a SHA-256 hash of that subject. Hosted Cloud deduplicates external IDs across the project, so sharing one constant ID between teachers would overwrite another teacher's choices. Every save is read back through the subject- and source-filtered `/v1/memories/list` route and must match both that external ID and the requested options before it is reported. The source is reserved for one preset per subject; duplicate or inconsistent list results are rejected. Core returns the subject in `user_id`; Hosted Cloud returns a project identity in `user_id` and the subject in `session_id`. Both mappings are checked before returning any preset. A correction updates the same external ID in place; it does not delete the previous choices before writing. If the new write fails, the UI reloads the provider state rather than claiming that nothing changed. All provider calls in one request share a four-second deadline. Forgetting requires Core's `{ success: true }` receipt or Hosted Cloud's `{ deleted: true, id }` receipt with the requested ID, plus a readback showing the preset is gone. The endpoints `GET`, `PUT` and `DELETE /api/game-rooms/preset` use the same session, origin, CSRF and teacher checks as room creation. Tests use a labeled local HTTP fixture: `apps/worker/test/room-preset.test.mjs`.

A real Hosted Cloud validation also passed: save, fresh-request recall, in-place update, teacher isolation and confirmed deletion. The real HTTP handlers were exercised with temporary local SQLite, synthetic authentication and the real memory provider; this does not establish a deployed public flow.

To repeat the opt-in live provider test from `apps/worker`, configure a Git-ignored `.dev.vars` with the API URL/key and run:

```bash
ATOMICMEMORY_LIVE_TEST=true node --env-file=.dev.vars --experimental-strip-types --test test/room-preset-live.test.mjs
```

The test creates unique synthetic subjects and removes their memories afterward. Normal `pnpm run check` skips this external-service test. Never put the key in browser variables or commit `.dev.vars`.

Google OAuth was verified in Edge and returned to the public dashboard. GitHub returned an email verification challenge; the callback now continues to the in-app code screen instead of treating that challenge as a failed login. Automated integration tests cover the encrypted OAuth continuation, successful code verification, PKCE forwarding, state/origin rejection, and direct OAuth success. After deployment, the real GitHub flow returned to the in-app verification screen in Edge. The user completed the emailed code, reached the public dashboard with the existing account and project, and the session persisted after reload. Both Google and GitHub public login flows are verified.

## Resume work

Read [PROJECT_STATUS.md](PROJECT_STATUS.md) for the latest handoff, verified behavior, local/public differences and next steps.

## WhatsApp notifications

The notification settings at /panel/notificaciones list automatic task-assignment, deadline and new-message alerts. Each type independently selects email, WhatsApp, both or none. The selection persists per tenant and user. Task and messaging producers will be connected when those modules exist; no synthetic events are generated. The public page has no test-send buttons or manual reminder forms. WhatsApp stores Peruvian mobile numbers in E.164 format with consent; all phone controls show a fixed `+51` prefix and accept nine national digits.

- Worker: modules/notifications follows the existing domain/application/infrastructure/HTTP boundaries. D1 migration 0002_notifications.sql adds contact verification and a durable outbox.
- A scheduled handler runs every minute, leases due rows, checks current consent, retries gateway failures with stable IDs, and polls delivery states. Accepted, sent and delivered are distinct; uncertain sends are not automatically replayed.
- apps/whatsapp-gateway runs separately on the VPS with encrypted SQLite auth, one sender session and an SSH-only admin page. See its README for deployment, pairing, retention and tests.
- WHATSAPP_GATEWAY_URL is server configuration. WHATSAPP_GATEWAY_TOKEN is a Worker secret; no gateway credential enters browser code.
- Saving a phone with consent immediately activates WhatsApp notifications. No recipient verification code or QR is required. Only the shared sender session is linked once by an administrator. Phone controls accept nine national digits and recognize pasted Peruvian country prefixes. Both notification registration and student assignment reject foreign or overlong mobile numbers on the server. The welcome send starts immediately after profile registration; scheduled retries preserve its original job ID.
- Legacy scheduling APIs remain for existing clients, with a limit of 20 messages per account and recipient phone per day and a 30-day scheduling window. The public UI no longer offers manual reminders or test sends; `/test` returns 410. Sender outages do not block phone registration.
- Changing the phone or disabling notifications cancels pending messages. Already accepted/in-flight messages cannot be recalled.
- UI dates identify the browser input timezone and history display timezone; persistence uses UTC epoch milliseconds.
- Full validation: pnpm run check, including the gateway tests. A passing mock does not establish real WhatsApp delivery.

The WhatsApp deployment uses D1 migrations 0002-0005, the Amautai Worker and the Docker service at /opt/amautai-whatsapp. Its dedicated gateway API is https://wts.urday.dev; the DNS-only A record points to the VPS, and Traefik serves the host directly. The unrelated notify.urday.dev record and routes are left unchanged. The gateway's authenticated HTTPS connection endpoint and sender reconnection after restart were verified. Pairing requires the sender's phone. Baileys is unofficial and sessions may be disconnected or restricted.

## Email notifications

Email is an independent notification channel beside WhatsApp on Dashboard → Notifications. Automatic alert preferences use GET/PUT /api/notifications/settings; PUT accepts one strict {type,channel} row. Types: task_assigned, task_due, new_message. Channels: email, whatsapp, both, none. Email is the default unless the account previously opted out. WhatsApp selection requires a registered recipient. Each pending automatic delivery rechecks its type preference before dispatch; changing a selection cancels excluded pending deliveries. The internal notifications entrypoint accepts authorized domain events, preserves per-channel idempotency and isolates channel failures. It has no public event-injection API. The recipient is always the authenticated account email; callers cannot supply arbitrary recipients. Email verification belongs to the WorkOS sign-in flow. The server carries WorkOS emailVerified into its trusted identity; a verified account can receive automatic notifications without a second code or activation step. Users can opt out and explicitly re-enable notifications. Preferences, history, cancellation, and daily limits are scoped to both tenant and user. Requests support stable idempotency keys. The UI preserves drafts after failures.

The existing minute cron dispatches each configured channel independently. Email uses HTTPS JMAP with the existing Stalwart server; no SMTP password reaches the browser and no additional VPS service is needed. Submission acceptance is not proof of inbox delivery. Network failures before submission retry at most five times; timeouts during submission and expired dispatch leases become uncertain and are never automatically resent. Disabling a channel cancels queued messages. A message already accepted by the server cannot be recalled.

Apply migrations 0003, 0004 and 0005 locally and remotely before publishing this version. Migration 0004 preserves legacy verified opt-outs, retires pending notification OTPs, and records explicit opt-out independently of account verification. Email dispatch skips its database entirely when configuration is missing, so a disabled channel does not block the existing WhatsApp scheduler.

Server-side configuration (use Wrangler secrets or ignored local `.dev.vars`, never frontend variables):

- `EMAIL_JMAP_SESSION_URL=https://mail.urday.dev/jmap/session`
- `EMAIL_JMAP_USERNAME`: dedicated sender account
- `EMAIL_JMAP_PASSWORD`: dedicated account/app password
- `EMAIL_FROM`: an identity authorized for that account, e.g. `notificaciones@amautai.urday.dev`

The sender account must have JMAP mail/submission access, a matching Identity, and a drafts mailbox. The adapter discovers the account and mailbox, validates that the API stays on the configured HTTPS origin, and submits plain-text templates. There is no delivery/bounce tracking yet. Automatic educational task events remain future work.

API under `/api/notifications/email`: GET overview; legacy POST schedule; PUT `/preferences` with `{enabled}`; DELETE `/:id`. Both channel `/test` endpoints return 410. Legacy scheduling endpoints remain for compatibility but have no public UI. Mutations retain same-origin and `X-Amautai-Request: 1` protections. Scheduling uses `{title,scheduledAt,requestKey}`.

### Historical VPS and sender-domain inspection — October 17, 2026

An initial read-only inspection confirmed a healthy Stalwart container, public SMTP submission ports 465/587, and JMAP mail/submission discovery at `https://mail.urday.dev/jmap/session` (HTTP 200). At that point, a sender account and DNS records had not yet been configured. The later activation and delivery results are recorded below.

`urday.dev` already used `MX 10 mail.urday.dev`. At inspection, `amautai.urday.dev` had no explicit MX, TXT/SPF, or `_dmarc` TXT records. The subsequent activation completed these steps:

1. Added `amautai.urday.dev` as a Stalwart mail domain and created the dedicated sender account.
2. Published `MX 10 mail.urday.dev`, SPF, Stalwart-generated DKIM, and an explicit DMARC policy for the subdomain.
3. Configured backend secrets and verified real receipt and SPF/DKIM/DMARC alignment in Outlook.

References: [Stalwart domains](https://stalw.art/docs/domains/), [JMAP mail and submission specification](https://www.rfc-editor.org/rfc/rfc8621.html).

Gateway deployment verification: Docker healthy; authenticated HTTPS returns connection state, unauthenticated API returns 401, and QR administration is reachable only through the local SSH tunnel. Gateway secrets are stored outside the checkout. Worker publication is performed after the full validation gate and remote migrations.

Sender pairing also supports an eight-character code from the SSH-only admin page. Enter the sender number with country code, digits only, and type the generated code in WhatsApp > Linked devices > Link with phone number. Codes and numbers are never printed to gateway logs. Refresh the admin page manually after linking.

The local pairing form keeps same-origin referrer information so browser POST requests pass the admin Origin check. Cross-origin pairing/reset requests remain rejected.

Pairing uses the recognized Chrome client identity. Cached pairing codes are reused briefly for the same number and cleared on socket replacement/disconnection, avoiding stale codes. Required initial LID mapping synchronization remains enabled.

### Email activation — October 17, 2026

The dedicated notificaciones@amautai.urday.dev account is provisioned in Stalwart and authenticates with JMAP mail/submission access. MX, SPF, RSA DKIM (selector v1-rsa-20261017), and DMARC records are published and resolve publicly. The public DKIM value matches Stalwart. The sender password is stored in protected configuration outside this repository and in Worker secrets; existing WorkOS and WhatsApp secrets are preserved.

Email is enabled in production (Worker d0d73c98-098c-47a2-8a30-3abab825b925). A verification requested through the real signed-in public UI was dispatched by the production cron and received in Diego's Outlook mailbox on October 17, 2026 at 15:56 Lima time. D1 recorded accepted and Stalwart recorded a final submission with SMTP 250; Outlook receipt was independently read through the connected mailbox. The notification's application status remains accepted because it does not yet reconcile delivery receipts. Outlook message-source headers independently confirm SPF=pass, DKIM=pass (d=amautai.urday.dev, selector v1-rsa-20261017), and DMARC=pass. Notification-specific codes have been removed; verified WorkOS account emails are ready to use by default.

Gateway HTTP requests reject redirects with manual redirect handling and log only sanitized failure categories. The browser session and Worker-to-VPS connection are verified independently.

The first production dispatch exposed the same Workers redirect-mode incompatibility seen in the WhatsApp transport. The JMAP adapter uses manual redirects and rejects non-success responses; it never follows redirects with credentials. A regression test covers this boundary.

WhatsApp sender pairing succeeded with the recognized Chrome identity. The authenticated gateway reports connected after a container restart, verifying persistent session recovery. Actual recipient delivery is verified separately from sender connectivity.

Earlier validation before GitHub backup: 60 backend tests, 3 frontend transport tests, 4 gateway tests and 9 architecture tests passed, along with lint, types and build. The current release gate and delivery evidence are recorded in [PROJECT_STATUS.md](PROJECT_STATUS.md).

Initial validation before direct registration: a real verification message sent through the public application to a separate recipient received a WhatsApp delivery acknowledgment. Diego completed recipient verification in the public application. A subsequent test notification requested through that UI was dispatched by production cron and received a WhatsApp delivery acknowledgment.

Direct WhatsApp registration replaces the former recipient OTP flow at POST /api/notifications/phone. The old WhatsApp /verify endpoint is removed. Existing historical verification fields are preserved without treating new registrations as ownership-verified. Tests cover immediate activation, phone normalization, opt-out, stale-recipient cancellation, user isolation, idempotency, and daily limits.

### Email friction reduction — October 17, 2026

Notification-specific verification endpoints now return 410 and point to sign-in verification; no new notification OTP is generated. Email destinations and verification state come exclusively from the authenticated server identity. Opt-outs persist across requests and verified address changes; a changed address cancels queued messages to the old address. No marketing subscription or additional consent event is fabricated. Existing login/signup/OAuth verification flows are preserved.

The direct-registration version was published as Worker 34ccf34a-4f96-44ba-9a6c-3685ebeaece2 after migration 0004 and the full gate (64 backend, 3 web, 4 gateway, 9 architecture tests; lint/types/build). Automated browser interaction saved the previously authorized recipient using country-code digits without a leading +, confirmed immediate activation with no OTP controls, and requested a test notification. The production gateway recorded delivered.

### Automatic preferences and authentication mail

Authentication mail is separate from activity preferences and opt-out: verification and password recovery remain required account workflows. With AUTH_EMAIL_MODE=custom, WorkOS creates and validates codes/reset tokens, while Amautai sends Spanish plain-text mail through the protected Stalwart sender. The adapter retrieves email_verification_id from password/signup/OAuth challenges; recovery uses the recipient and reset URL returned by WorkOS. Codes/tokens are never returned to the browser API or stored in the notification outbox. Recovery links must target the approved Amautai reset endpoint. Delivery failures return a service error; no silent provider fallback or uncertain replay occurs.

Activation order: deploy the custom mail implementation and AUTH_EMAIL_MODE=custom, then disable only Email verification and Password reset in WorkOS Andes Staging → Emails → Configuration. Other environment emails remain unchanged. Local development must explicitly use AUTH_EMAIL_MODE=custom and protected EMAIL_* variables once WorkOS default delivery is disabled. Keep the WorkOS-issued verification and reset flows; changing the transport does not replace authentication.

The custom-mail release was published as Worker b438d08f-2d46-4063-967c-d9f3608fc5bd with migration 0005 on October 17, 2026. WorkOS delivery for verification/reset is disabled in the isolated environment. A real public recovery request arrived in Outlook Inbox from the Amautai sender at 16:41:02 Lima. No password was changed. Verification challenge delivery is covered by automated password/signup/OAuth tests; a fresh real signup remains untested in this release.

## Cloudflare deployment

Canonical URL: https://amautai.turistivo.com. `apps/worker/wrangler.jsonc` targets the Turistivo Cloudflare account (`49d9cc4a3f40d7228ed3593263d35588`), binds that domain directly to the `amautai` Worker, and uses its D1 database. Do not deploy a separate domain proxy. Worker secrets are provisioned separately and never committed.

Build and deploy the application:

```bash
pnpm --filter @amautai/worker exec wrangler d1 migrations apply andes-app-db --remote
pnpm --filter @amautai/worker exec wrangler deploy
```
