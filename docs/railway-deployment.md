# Railway Deployment Configuration

## Overview

Loona is deployed on [Railway](https://railway.com) using Railpack (Railway's buildpack system) which auto-detects Node.js projects — no Dockerfile required.

---

## `railway.json`

Located at the repo root. This file is Railway's config-as-code equivalent.

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "node --max-old-space-size=4096 ./node_modules/.bin/vite build"
  },
  "deploy": {
    "startCommand": "node .output/server/index.mjs",
    "preDeployCommand": "npm run db:migrate",
    "healthcheckPath": "/",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "overlapSeconds": 20,
    "drainingSeconds": 10
  }
}
```

### Field Reference

| Field | Value | Why |
|---|---|---|
| `builder` | `RAILPACK` | Use Railway's buildpack (no Dockerfile needed) |
| `buildCommand` | `vite build` with `--max-old-space-size=4096` | Prevents Node OOM during SSR build |
| `startCommand` | `node .output/server/index.mjs` | TanStack Start SSR server output location |
| `preDeployCommand` | `npm run db:migrate` | Runs Drizzle migrations before new instance goes live |
| `healthcheckPath` | `/` | Railway polls this to confirm the new deploy is up |
| `healthcheckTimeout` | `30` | Seconds to wait for healthcheck before marking deploy failed |
| `restartPolicyType` | `ON_FAILURE` | Auto-restart crashed instances |
| `restartPolicyMaxRetries` | `3` | Give up after 3 crash-restart cycles |
| `overlapSeconds` | `20` | Zero-downtime: keep old instance alive for 20s while new one starts |
| `drainingSeconds` | `10` | Grace period for in-flight requests before old instance is killed |

---

## Required Environment Variables

Set these in the Railway dashboard under **Variables**.

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret for Better Auth session signing |
| `BETTER_AUTH_URL` | Full app URL (e.g. `https://www.loona.ph`) |
| `RAILPACK_NO_SPA=1` | **Critical** — prevents Railpack from treating Vite+React as a static SPA and skipping the SSR server |
| `RESEND_API_KEY` | Email sending via Resend |
| Any other app secrets | See `.env.example` if present |

> **Note on `RAILPACK_NO_SPA=1`:** Without this, Railpack detects the Vite config and assumes the app is a client-only SPA, serving static files without starting the SSR server. This causes all server functions and auth to silently fail.

---

## Build & Deploy Flow

```
git push → Railway detects push
    → npm install (Railpack)
    → buildCommand: vite build  (outputs to .output/)
    → preDeployCommand: npm run db:migrate  (runs with DATABASE_URL)
    → startCommand: node .output/server/index.mjs
    → healthcheck GET /  (waits up to 30s)
    → old instance drained (10s) after overlap (20s)
```

Migrations run **before** the new server starts, so the DB is always ahead of the code — safe for additive migrations.

---

## Custom Domain Setup (loona.ph via Cloudflare)

Both `loona.ph` and `www.loona.ph` are added as custom domains in Railway (requires paid plan for multiple domains).

**DNS records in Cloudflare:**

| Type | Name | Target |
|---|---|---|
| CNAME | `www` | `<your-service>.up.railway.app` |
| CNAME | `@` (apex) | `<your-service>.up.railway.app` |

Cloudflare's **CNAME flattening** at the apex (`@`) makes the bare domain work even though standard DNS doesn't allow CNAME at root.

> **Important:** Keep Cloudflare proxy (orange cloud) **enabled** for both records. This handles SSL termination and caching. Railway issues its own certificate for the Railway subdomain; Cloudflare issues the cert the user sees.

---

## `npm run db:migrate`

Defined in `package.json`, this runs:

```
drizzle-kit migrate
```

To generate a new migration after schema changes:

```bash
npx drizzle-kit generate
# review the generated SQL in drizzle/
npx drizzle-kit migrate  # apply locally
git add drizzle/ && git commit
# Railway will apply it on next deploy via preDeployCommand
```

---

## Rollback

Railway keeps previous deploys in the dashboard. To roll back:
1. Go to **Deployments** tab
2. Click the previous successful deploy
3. Click **Redeploy**

Note: This redeploys old code but does **not** roll back DB migrations. Keep migrations additive (add columns, don't drop) to keep rollbacks safe.
