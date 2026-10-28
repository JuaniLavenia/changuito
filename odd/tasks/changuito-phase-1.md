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

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1 | inline | done | feat/01-scaffold (see Log L4) |
| T2 | S6, S8 | inline (test-first, domain) | pending | — |
| T3 | S3, S4, S5 | inline (migrations, RLS, seed) | pending | — |
| T4 | S2, S3, S4 | inline (auth + onboarding UI) | pending | — |
| T5 | S5 | inline (catalog UI) | pending | — |
| T6 | S6 | inline (stock review UI) | pending | — |
| T7 | S7 | inline (shopping mode + realtime) | pending | — |
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
