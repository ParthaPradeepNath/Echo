# Echo

![Echo](public/hero.png)

Overview

- Small private, self-destructing chat built with Next.js and Elysia.
- Realtime features use Elysia realtime/Redis and Upstash for persistence.

Quick Start (local)

1. Install

```bash
bun install
```

2. Environment

- Copy `.env` example (or create `.env.local`) and set:
  - `NEXT_PUBLIC_API_URL=http://localhost:3000`
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

3. Run dev server

```bash
bun run dev
```

Key files

- API server (Elysia routes): `src/app/api/[[...slugs]]/route.ts`
- Client helper: `src/lib/client.ts` (use `getClient()` in browser code)
- CORS config helper: `src/lib/cors.ts`
- Realtime helpers: `src/lib/realtime.ts`, `src/lib/realtime-client.ts`

Environment & Deployment

- In Vercel, set the following environment variables (Production scope):
  - `NEXT_PUBLIC_API_URL=https://<your-vercel-app>.vercel.app`
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Redeploy after updating env vars.

CORS & Common Issues

- The deployed app must not call `localhost:3000`. Ensure `src/lib/client.ts` resolves the API origin at runtime in the browser (uses `window.location.origin` or `NEXT_PUBLIC_API_URL`).
- Server must expose CORS headers. Use the Elysia CORS plugin and the helper at `src/lib/cors.ts`:

```ts
import { cors } from '@elysiajs/cors'
import { getCorsConfig } from '@/lib/cors'

new Elysia().use(cors(getCorsConfig())).get(...)
```

- For cookies/credentials, set `credentials: true` and use a specific allowed origin (not `*`).

Troubleshooting

- Error `ERR_CONNECTION_REFUSED` to `http://localhost:3000/api/...` in production: your client was built with `localhost` baked-in. Use a runtime client (`getClient()`) and set `NEXT_PUBLIC_API_URL` in Vercel.
- CORS preflight failing: ensure your route handlers respond to `OPTIONS` and that CORS plugin is applied globally or before routes.

Using the treaty client (browser)

```ts
import { getClient } from "@/lib/client";

const client = getClient();
await client.room.create.post();
```

Next steps

- Review this file and adjust any organization-specific URLs or commands.
- Confirm `NEXT_PUBLIC_API_URL` in Vercel and redeploy.

Credits

- Built with Next.js, Elysia, and Upstash (Redis).
