Balu Honda live stock lookup app.

## Architecture

User traffic reads from Supabase, not directly from Zoho.

- `/api/stock` reads cached rows from Supabase.
- `/api/sync-stock` pulls the latest Zoho sheet rows and refreshes the cache.
- `vercel.json` runs the sync every 5 minutes.

This avoids Zoho Sheet rate-limit failures on normal user traffic.

## Required environment variables

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_DOCUMENT_ID`
- `ZOHO_REFRESH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## Supabase tables

Run the SQL in [supabase/schema.sql](/C:/Anand/Projects/zoho-stock-pwa/zoho-stock-pwa/supabase/schema.sql) in the target Supabase project.

The tables are isolated to this app and do not conflict with existing projects:

- `public.balu_honda_live_stock_cache`
- `public.balu_honda_live_stock_sync_state`

## Sync behavior

Vercel Cron calls:

- `/api/sync-stock`

Schedule:

- every 5 minutes

For manual sync testing, call:

```text
/api/sync-stock?key=<CRON_SECRET>
```

If `CRON_SECRET` is set, the sync route requires either:

- `Authorization: Bearer <CRON_SECRET>`
- `?key=<CRON_SECRET>`

## Local development

```bash
npm run dev
```
