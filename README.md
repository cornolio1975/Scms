# SCMS — Sports Club Management System

Next.js application for SP SportData Solution.

## Hostinger production deployment

See [the Hostinger deployment guide](docs/HOSTINGER.md) for `scms.spsportdatasolution.org`, required environment values, build settings, source ZIP deployment, acceptance checks and rollback.

## Development

Use Node.js 22 LTS. Copy `.env.example` to `.env.local` and enter your SCMS Supabase project values locally. Never commit credentials.

```sh
npm ci
npm run dev
```

Before release:

```sh
npm run typecheck
npm run build
```

GitHub Actions runs these checks with non-production build fixtures. This does not verify live database access or authentication.
