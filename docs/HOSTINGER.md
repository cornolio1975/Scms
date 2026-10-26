# SCMS on Hostinger

Target: https://scms.spsportdatasolution.org

Use a plan supporting Node.js web apps and select the Next.js preset. This app
uses server routes, middleware and Supabase sessions; static hosting is insufficient.

| Setting | Value |
| --- | --- |
| Repository | cornolio1975/Scms |
| Branch | main |
| Root directory | repository root |
| Node.js | 22 LTS |
| Install | npm ci |
| Build | npm run build |
| Start (standard Next.js preset) | npm start |
| Build directory | .next |

Let Hostinger supply PORT. Do not configure a fixed port. To emit
`.next/standalone` for hosts requiring a minimal Node server, build with
`SCMS_STANDALONE=1`. For that deployment
mode copy `public` and `.next/static` into the same corresponding paths under
`.next/standalone`, then run `node .next/standalone/server.js` with HOSTNAME=0.0.0.0.
Do not use `next start` with only the standalone directory uploaded.

## Environment

Set the two required variables named in `.env.example` in Hostinger before the
build. Use the existing SCMS Supabase project's URL and publishable key. Public
variables are compiled into browser assets; changing them requires a rebuild.
Keep KARATETECH_API_KEY server-side and preserve the existing integration URL.
Never put service-role keys or secrets in NEXT_PUBLIC_ variables or the ZIP.

### Athlete transfer connection errors

Set `KARATETECH_API_URL` to the actual KarateTech **Node.js server** origin
(including any configured base path). Set `KARATETECH_API_KEY` to the secret
accepted by that server. Restart SCMS after changing server environment values.
SCMS no longer silently connects to localhost when production configuration is missing.

The confirmed KarateTech destination for this project is
`https://karatetech3.spsportdatasolution.org`. Set
`KARATETECH_API_URL=https://karatetech3.spsportdatasolution.org` in the SCMS
server environment; changing `.env.example` alone does not change a live deployment.

The receiving deployment must implement `GET /api/integration/scms/health`,
`POST /api/integration/scms/participants`, and
`POST /api/integration/scms/participants/batch`. A static KarateTech export
cannot serve these routes. The current KarateTech3.0 main branch has public
tournament routes but no SCMS athlete receiver; deploying SCMS alone does not
add those endpoints to KarateTech. Confirm the receiver deployment before retrying.

In the SCMS Supabase project's Auth URL settings, set the production Site URL to
`https://scms.spsportdatasolution.org` and allow these redirect destinations:

- `https://scms.spsportdatasolution.org/auth/callback`
- `https://scms.spsportdatasolution.org/reset-password`

Keep the Supabase Google provider callback configured to its existing Supabase
callback URL. These instructions do not modify Supabase, DNS, data or auth settings.

## Deploy source without GitHub integration

From a clean checkout of the intended commit, run `npm run package:hostinger`.
Upload `artifacts/scms-hostinger-source.zip` as a Node.js source project and apply
the same settings above. The ZIP contains committed files only. It excludes
node_modules, .next, .git, real .env files and local diagnostic scripts.

## Acceptance and rollback

After Hostinger reports success, verify HTTPS, the landing page, logo/CSS,
login, dashboard permissions, Google sign-in and password recovery on the target
domain. Verify KarateTech synchronization with an authorized test record before
claiming integration success. Build-only fixtures do not verify these workflows.
Keep the previous successful Hostinger deployment available for rollback. No
database migration or destructive operation is required by this preparation.

References:
- https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- https://nextjs.org/docs/app/getting-started/deploying
