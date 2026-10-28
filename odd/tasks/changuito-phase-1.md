# Changuito — Phase 1 (MVP)

Objective: a shared web app that covers one full monthly supermarket trip: household, catalog, stock review, list, shopping, close. Branches: one per slice, `feat/NN-<slice>`, stacked on the previous one. Delivery: ask-on-risk, chain: stacked-to-main. Test runner: Vitest (domain + web), SQL tests via `supabase test db`.
Reference: `docs/PROPOSAL.md`.

## Specs

- **S1 — Stack.** pnpm monorepo: `apps/web` (React, Vite, TS, Tailwind, Zustand, TanStack Query, Radix), `packages/domain` (pure TS), `supabase/` (migrations, RLS, seed). Netlify hosts the front; Supabase is the backend. User: "vamos con Netlify para el front y Supabase para el back".
- **S2 — Auth.** Google sign-in only. User: "con Google me parece mejor, mis viejos usan Android."
- **S3 — Households.**
  - Each household has an invite code; a user creates a household and shares the code.
  - A user may belong to several households (assumption accepted by the user).
  - The creator is admin and can regenerate the code. Codes don't expire.
  - Each household's data is isolated by RLS.
  - User: "cada casa tenga su codigo de invitacion, por ejemplo, en mi casa somos mis padres y yo, yo crearia el hogar y le compartiria el codigo a mis padres para que ellos accedan" … "cada hogar tenga su propia lista."
- **S4 — Catalog.**
  - A base catalog (~80–100 typical Argentine monthly products, grouped by store section) is offered at onboarding.
  - The chosen items are copied into the household.
  - Products are editable and new ones can be added.
  - The catalog is a data file in the repo.
  - User: "el catalgo que traiga uno base, pero editable y para que se puedan agregar mas."
- **S5 — Product fields.**
  - Generic name, section, unit (`unit`, `kg`, `g`, `l`, `ml`, `pack`), optional preferred brand, expected monthly consumption (entered by hand in Phase 1).
  - User: "algunas cosas muy puntuales si compramos de cierta marca, pero luego lo demas casi siempre buscamos la que este a mejor precio".
- **S6 — Stock review and quantity rule.**
  - The user enters the current stock per product.
  - Suggested quantity = `max(0, expectedMonthlyConsumption - currentStock)`.
  - Products with 0 to buy are not listed. Quantities can be edited by hand.
  - User: "si decimos "quedan 2 latas de tomate" y anotamos lo que vamos a comprar, por ejemplo, si en el mes pensamos que vamos a usar 4 latas, anotamos para comprar 2 latas. Y si no tenemos, decimos "no nos quedan latas de tomate", y anotamos las que pensamos que vamos a consumir en el mes."
- **S7 — Shopping mode.**
  - Items are ordered by section.
  - Check-off syncs in real time across phones and shows who checked it.
  - Price is recorded on check-off and brand is optional.
  - User: "yo vaya a un pasillo a ver algo y mi padre siga haciendo las compras con su celular."
- **S8 — Close trip.**
  - Items not bought get a reason: `unavailable` ("no habia en el supermercado") or `too_expensive` ("el precio era caro").
  - On close, skipped items are offered for the next month's list.
- **S9 — Deploy.**
  - `netlify.toml` builds `apps/web`.
  - The README documents Supabase setup (project, Google OAuth, migrations).
  - Remote setup itself is the user's action.
- **S10 — UI language.**
  - All user-facing copy is in neutral Latin American Spanish ("tú" forms). Code and comments stay in English.
  - User: "quiero que este en español latino".

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1 | inline | done | feat/01-scaffold (see Log L4) |
| T2 | S6, S8 | inline (test-first, domain) | done | feat/02-domain (see Log L5) |
| T3 | S3, S4, S5 | inline (migrations, RLS, seed) + independent verifier | done | feat/03-database (see Log L6) |
| T4 | S2, S3, S4, S10 | inline (auth + onboarding UI) | done | feat/04-auth-onboarding (see Log L8) |
| T5 | S5, S10 | inline (catalog UI) | done | feat/05-catalog-stock (see Log L9) |
| T6 | S6, S8, S10 | inline (stock review UI) | done | feat/05-catalog-stock (see Log L10) |
| T7 | S7 | inline (shopping mode + realtime) | done, integration pending (Docker off) | feat/06-shopping-close (see Log L14) |
| T8 | S8 | inline (close trip UI) | pending | — |
| T9 | S9 | inline (Netlify + README) | pending | — |

Route evidence: no Writer trigger reason. Tasks are sequential, each depends on the previous one, so the parent writes inline. T3 touches RLS (security, high risk), so it gets an independent verifier.

Size forecast: ~3–4k authored lines (exceeds 400). Chain: stacked-to-main, one PR per task. PR N targets main after PR N-1 merges, and branch `feat/NN-*` is based on `feat/(NN-1)-*`. Slices: PR1=T1 (`feat/01-scaffold`), PR2=T2, PR3=T3, PR4=T4, PR5=T5+T6, PR6=T7+T8, PR7=T9 (adjusted as the line counts come in).

## Log

- **L1 (2026-10-22), original request:** "quisiera hacer una app web para organizarme con el tema de ir de compras al supermercado. En mi casa hacemos compras mensuales, y siempre vamos luego que cierran las tarjetas de credito asi la compra entra un mes despues. Antes de ir al supermercado revisamos el stock de las cosas que tenemos y hacemos la lista de las cosas que nos falta y de las cosas que no tenemos. Luego en el supermercado vamos tachando las cosas que vamos poniendo en el carrito. A veces traemos todas las cosas de la lista y a veces no, algunas veces porque no habia en el supermercado y otras porque el precio era caro. Me ayudas a desarrollarla?"
- **L2 (2026-10-22), decisions:**
  - Phases approved: "si, me cierra el orden de las fases!"
  - Name: "Changuito".
  - Units and catalog defaults: "dale me cierra todo, arranquemos".
  - RDD is globally off: no native review, ordinary checks only.
- **L3 (2026-10-22), chain strategy:** "ahi lo cree al repo: https://github.com/JuaniLavenia/changuito Vamos con stacked-to-main".
  - Remote `origin` added locally. Nothing pushed: push and PRs are the user's call.
  - `main` has an empty root commit so PR1 has a base.
- **L4, T1 evidence:**
  - `pnpm --filter @changuito/web test`: 1 passed.
  - `build`: ok.
  - `lint`: clean.
  - Domain has no tests yet (T2).
- **L5, T2 evidence:**
  - RED: 4 test files failed (modules missing).
  - GREEN: `pnpm --filter @changuito/domain test` gives 22 passed. `typecheck` clean.
  - Rules: `suggestQuantity` (S6), `buildSuggestedList` (a missing stock entry counts as 0; skipped items are re-offered and flagged `carriedOver`), `checkItem`/`uncheckItem`/`skipItem` (S7/S8), `closeTrip` (refuses pending items; carryOver = skipped), `sortBySection`.
  - Assumption: `price` is the unit price.
- **L6, T3 evidence:**
  - Schema, RLS, RPCs and realtime are in `supabase/migrations/20261022000000_init_schema.sql`. The base catalog (88 products, 11 sections) is in `packages/domain/src/catalog/base-catalog.json`.
  - Independent verifier: no blockers; S3, S4, S5 pass. Probes ran in a temp scratch dir inside rolled-back transactions.
  - Advisories applied:
    - `checked_by` is forced to `auth.uid()`.
    - Direct close or reopen is guarded by a trigger.
    - Items of a closed list are frozen.
    - User FKs use `on delete set null`.
    - Product FKs are deferred, so history blocks product deletes. Products get `archived_at`.
    - `skip_nonce_check = false`.
  - Deferred (out of S3): leave or remove a member, delete a household, `join_household` rate limit.
  - `pnpm test:db`: 23/23 pass. `pnpm --filter @changuito/domain test`: 26 passed.
  - `supabase/.env.example` was blocked by a local deny rule. The Google env var names are documented in the README instead (T9).
- **L7 (2026-10-22), UI language:** "genial, quiero que este en español latino". This adds S10 and applies from T4 on.
- **L8, T4 evidence:**
  - RED: 2 web test files failed (modules missing).
  - GREEN: `pnpm --filter @changuito/web test` gives 8 passed (2 integration tests skipped without env).
  - `test:integration` against local Supabase: 2 passed (create with catalog, join lowercase code, list, regenerate, member regenerate rejected, unknown code mapped to `InvalidInviteCodeError`).
  - typecheck clean, lint clean, build ok, react-doctor 100/100.
  - Fixed a race: the new household is seeded into the query cache before navigating home.
  - Runtime harness N/A: Google OAuth needs real credentials, which the user supplies in T9.
  - Architecture: repository ports in `app/repositories.ts` with Supabase adapters per feature. Tests use in-memory fakes (`src/test/fakes.tsx`).
- **L9, T5 evidence:**
  - RED: 6 catalog tests failed.
  - GREEN: web unit tests 14 passed. `test:integration` 3 passed (catalog adapter: list/create/edit/archive, section sort order).
  - typecheck and lint clean, react-doctor 100.
  - Products are archived (`archived_at`), never deleted.
  - Correction: the T4 commit left a typecheck error (`process` in the integration test without node types). Fixed here by adding `node` to `tsconfig.app.json` types.
  - Integration helpers are shared in `src/test/integration.ts`.
- **L10, T6 evidence:**
  - New migration `20261023000000_create_shopping_list.sql` adds an atomic RPC (review + list + items, security invoker).
  - pgTAP: 29/29 (6 new).
  - Honest note: the RPC was written before its SQL test, so there was no RED for it. The UI tests had RED (5 failed) and are now GREEN.
  - Web unit tests: 19 passed. Integration: 4 passed (create list, open list, close with a skipped item, carry-over).
  - typecheck and lint clean, react-doctor 100.
  - Every catalog product goes into the stock snapshot (an empty input counts as 0).
- **L11 (2026-10-22), pause:** the user said "me tengo que ir, es para que sigamos despues!"
  - Next: T7 (shopping mode + realtime, route `/super`), then T8 (close trip UI), then T9 (Netlify + README + Google OAuth setup).
  - Nothing pushed. Local Supabase may still be running in Docker (`pnpm exec supabase stop` to stop it).
- **L12 (2026-10-22), push:** "guardame todo en engram y pushea todas las ramas. Cuando vuelva seguimos y cuando terminemos hacemos los PR".
  - All `feat/01`..`feat/05` branches were pushed with upstream.
  - Remote `main` had a GitHub "Initial commit" (README.md) with unrelated history. It was merged into local `main` with `--allow-unrelated-histories` (85db29c) and pushed. No force push; the feature branches were not rewritten.
  - The T9 README must build on the existing README.md from main (expect a trivial conflict on PR7).
  - PRs are opened after T9, at the user's request.
- **L13 (2026-10-28), Phase 2 backlog:** "dale, anotalo para fase 2, lo usariamos con Brevo que ya lo estoy usando en otro proyecto."
  - Email/password sign-in (in addition to Google) is deferred to Phase 2. It needs custom SMTP (Brevo), because Supabase's default SMTP only sends to team members (~2/hour).
  - The trigger was a concern that Google OAuth costs money after the Cloud free trial. Creating an OAuth client is free and Supabase Auth handles sign-in, so S2 stays unchanged for Phase 1.
  - `feat/05` has nothing pending; T7 starts on `feat/06-shopping-close` (based on `feat/05`).
- **L14, T7 evidence:**
  - Route `/super` (nav "Súper"). Items grouped by section in store order, "N de M en el carrito".
  - Check-off opens a dialog: unit price and brand (prefilled with the preferred brand). Shows "Lo tachó <name> · <brand> · <price>". Items can be unchecked.
  - Realtime: `subscribeToItems` listens to `postgres_changes` on `list_items` filtered by `list_id` and invalidates the items query.
  - Assumption: price may be left empty (stored as null), so a check-off in the aisle is never blocked. To revisit if the user wants it required.
  - RED: 5 failed (page missing). GREEN: web unit tests 24 passed. typecheck and lint clean, build ok, react-doctor 100.
  - Pending: `test:integration` (new `listItems`/`saveItem` test with the `products` embed and the profile name) because Docker was not running. The realtime adapter has no automated test; it needs a manual check with two phones.
