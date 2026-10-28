# Changuito

A shared web app for the monthly supermarket trip: review the stock at home, build the list, check items off together in the store, and close the trip with what was left out.

- **Front end:** React + Vite + TypeScript in `apps/web`, hosted on Netlify.
- **Back end:** Supabase (Postgres, Auth with Google, Realtime), defined in `supabase/`.
- **Domain rules:** pure TypeScript in `packages/domain`.

## Local development

Requirements: Node 22.23.4 or a later 22.x security release (pinned in `.nvmrc` and `netlify.toml`), pnpm 9 (`corepack enable`), and Docker Desktop for the local Supabase stack.

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Optional, to sign in with Google locally: create a `.env` file at the repository root (it is git-ignored) with the Google OAuth client described in [Google OAuth](#2-google-oauth). The local stack reads it through `supabase/config.toml`.

   ```sh
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client id>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client secret>
   ```

3. Start Supabase. This applies the migrations in `supabase/migrations`:

   ```sh
   pnpm db:start
   ```

4. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with `API_URL` and `ANON_KEY` from `pnpm exec supabase status -o env`.

5. Run the app at http://127.0.0.1:5173:

   ```sh
   pnpm dev
   ```

The Supabase containers restart with Docker until you stop them. Stop them when you are done; your local data is kept:

```sh
pnpm exec supabase stop
```

### Checks

| Command | What it runs |
|---|---|
| `pnpm test` | Unit tests for `packages/domain` and `apps/web` |
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint |
| `pnpm test:db` | pgTAP tests for the schema, RLS and RPCs (needs the local stack) |
| `pnpm --filter @changuito/web test:integration` | Repository adapters against the local stack |

The integration tests need the local keys exported first (`ANON_KEY` and `SERVICE_ROLE_KEY` from `pnpm exec supabase status -o env`):

```sh
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_ANON_KEY=<ANON_KEY>
export SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

## Deploy

Setting up the remote services is done once, by hand, in this order: Supabase project, Google OAuth, Netlify, and then the final URLs.

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (the free plan is enough). Write down the **project ref**, the `xxxx` in `https://xxxx.supabase.co`.
2. Apply the migrations from your machine:

   ```sh
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project ref>
   pnpm exec supabase db push
   ```

   The migrations create the tables, the RLS policies, the RPCs and the Realtime publication for `list_items`. Run `db push` again whenever a new migration is added.
3. Copy the **Project URL** and the **anon public key** (the dashboard's **Connect** button shows both; the newer *publishable* key works too). Netlify needs them in step 3.

### 2. Google OAuth

Creating an OAuth client is free. It does not use Google Cloud credits and needs no billing account.

1. In the [Google Cloud console](https://console.cloud.google.com), create a project and open **Google Auth Platform**.
2. **Branding:** set the app name (Changuito) and a support email.
3. **Audience:** choose **External**. While the app is in *Testing*, only the test users you add can sign in. Move it to *In production* to open it to everyone; the app only asks for the basic scopes (`openid`, `email`, `profile`), so Google does not require a verification review.
4. **Clients → Create client → Web application:**
   - Authorized JavaScript origins: your Netlify URL (for example `https://changuito.netlify.app`) and `http://127.0.0.1:5173` for local development.
   - Authorized redirect URIs: `https://<project ref>.supabase.co/auth/v1/callback`, and `http://127.0.0.1:54321/auth/v1/callback` for local development.
5. Copy the **client ID** and **client secret**.
6. In Supabase, open **Authentication → Sign In / Providers → Google**, enable it, and paste the client ID and secret.

### 3. Netlify

1. In [Netlify](https://app.netlify.com), choose **Add new site → Import an existing project** and pick this GitHub repository. `netlify.toml` already sets the build command, the publish directory and the SPA redirect.
2. In **Site configuration → Environment variables**, add:
   - `VITE_SUPABASE_URL`: the Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: the Supabase anon public key.
3. Deploy. Vite embeds these values at build time, so trigger a new deploy whenever they change.

### 4. Final URLs

1. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to the Netlify URL and add it to **Redirect URLs**.
2. Make sure the same Netlify URL is in the Google client's authorized JavaScript origins.
3. Smoke test with two phones: sign in on both, create a household on one, join it with the invite code on the other, build a list, and check an item off on one phone. It should appear checked on the other within a second or two, with who checked it.
