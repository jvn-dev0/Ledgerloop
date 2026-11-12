# Supabase Setup and Existing-Account Recovery

LedgerLoop authenticates users with Supabase Auth and loads a business workspace from `public.businesses`. A successful sign-in can still lead to `/setup?reason=business` when the database schema is missing or the account predates the schema.

## Apply the database migrations

In the Supabase Dashboard, open **SQL Editor** and run these files in order:

1. `supabase/migrations/20261109000100_initial_schema.sql`
2. `supabase/migrations/20261109000200_backfill_existing_businesses.sql`

The Day 1 trigger creates workspaces for users registered after the schema is installed. The second migration inserts a workspace for each existing auth user who does not already have one. It leaves existing business records unchanged and is safe to apply more than once.

For the full Day 1–4 feature set, continue with the remaining migrations in filename order. Enable the `vector` extension before applying the Day 3 migration.

After the SQL succeeds, refresh the app at `http://localhost:3008`. If the signed-in account still returns to setup, sign out and sign back in.

## Local email authentication URLs

For local development on port 3008, configure Supabase **Authentication → URL Configuration** with:

- **Site URL:** `http://localhost:3008`
- **Redirect URL:** `http://localhost:3008/auth/callback`

Email confirmation and password-reset links are single-use and can expire. After changing these values, request a fresh email and open the newest link.

## Local secrets

Keep project keys in `.env.local`, which is ignored by Git. Do not put a Supabase secret/service-role key or an AI provider key in a `NEXT_PUBLIC_` variable or commit it to the repository.
