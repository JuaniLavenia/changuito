# Changuito — Phase 2: where each product is bought

Objective: each product belongs to a household store (Súper, Veterinaria, Química, …); shopping mode works per store and each store is closed on its own inside the one monthly list. Branches: `feat/stores-NN-<slice>`, one PR per task, each based on `main` after the previous one merges. Delivery: ask-on-risk, chain: stacked-to-main (cached from Phase 1). Test runner: Vitest (domain + web), pgTAP via `supabase test db`, `test:integration` against local Supabase.

## Specs

- **S1 — Stores per household.**
  - Each household has an editable list of stores. New and existing households start with **Súper**, **Veterinaria** and **Química**, in that order.
  - Members can rename, add and remove stores. User, choosing the editable list over a fixed one: "dale me parece bien".
  - Assumption: a store is archived, not deleted, so past trips keep it. A store can't be removed while active products use it or while it has pending items in the open list. A household always keeps at least one active store.
- **S2 — Store per product.**
  - Every product has one store. Existing products start in **Súper**; the user moves them from the catalog. User (Phase 1, L20): "las piedritas para los gatos, y el alimento de gato y perro, no lo compramos en el supermercado" … "el jabon para la ropa, lo compramos en una quimica por bidon".
  - Assumption: in the base catalog, the "Mascotas" section starts in **Veterinaria** for new households; everything else starts in **Súper**.
  - Assumption: existing sections (including the Phase 1 workaround sections "Mascotas" and "Química") are left as they are.
- **S3 — One monthly list with partial closes.** User: "dale, una lista del mes con cierres parciales."
  - The monthly list stays one list. Each list item keeps the store its product had when the item was added (assumption: moving a product later does not move items already on a list).
  - A store is closed for the month when none of its items are pending (each is in the cart or skipped with a reason). After that, its items can no longer change.
  - The month's list closes by itself when the last store with items is closed. Carry-over and the trip summary work as today.
- **S4 — Shopping mode per store.**
  - Shopping mode shows one store at a time, with a picker of the stores that have items on the list, and which of them are already closed.
  - "Terminar en <store>" asks for the skip reasons of that store's pending items and closes the store. When it is the last store, the trip summary shows as today.
- **S5 — Home summary per store.** Assumption: while shopping, the month status shows the progress of each store (closed, or "X de N en el carrito").
- **S6 — UI language.** User-facing copy in neutral Latin American Spanish ("tú"), as in Phase 1. Code and comments in English.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1, S2, S3 | inline (migration, RLS, RPC, pgTAP) + independent verifier | done: verified (L5, L6) | see L6 |
| T2 | S1, S2, S6 | inline (domain types, catalog repo, catalog UI: store field and store management, onboarding catalog store) | pending | |
| T3 | S3, S4, S6 | inline (shopping repo, shopping mode per store, partial close) | pending | |
| T4 | S5, S6 | inline (home month status per store) | pending | |

Route evidence: no Writer trigger reason. Each task depends on the previous one (schema → catalog → shopping → home), so the parent writes inline. T1 changes existing stored data (backfill), adds RLS and changes the list close rules: risk items 1, 2 and 4, so it gets an independent verifier and its own commit.

Size forecast: T1 ~400, T2 ~450, T3 ~450, T4 ~150 authored lines (~1.5k total, over 400): one PR per task.

## Log

- **L1 (2026-10-29), original request:** "dale, arranquemos por dónde se compra" (Phase 2 backlog item from `changuito-phase-1.md` L20: "where it is bought" field per product, list filtered by store and a close per store).
- **L2 (2026-10-29), decisions:**
  - Close model: "dale, una lista del mes con cierres parciales." Rejected: one separate list per store (breaks the one-list-per-month home summary, history and carry-over).
  - Stores: "dale me parece bien" to an editable list per household starting with Súper, Veterinaria and Química; existing products start in Súper.
  - RDD is globally off (`gentle-ai review mode status`): ordinary checks only.
- **L3, T1 design:**
  - `stores` (household scoped, `archived_at`, `sort_order`, unique active name per household), RLS like `sections`.
  - `products.store_id` not null, composite FK to `stores`. A trigger fills it with the household's first active store when the client omits it, so the current client keeps working.
  - `list_items.store_id` not null, filled by a trigger from the product on insert (snapshot).
  - `list_store_closures (list_id, store_id)`: a guard refuses a close while the store has pending items. Items of a closed store can't change.
  - RPC `close_list_store(p_list_id, p_store_id)` closes the store and then the list when no store with items is left open. `create_household` seeds the three stores and honours an optional `store` per catalog section.
  - The backfill disables only the list item triggers that would refuse or touch closed history, and re-enables them in the same migration.
- **L4 (2026-10-29), T1 written, blocked on Docker:**
  - Written: `supabase/migrations/20261030000000_stores.sql` and `supabase/tests/stores.test.sql` (18 pgTAP assertions covering S1–S3).
  - Kept existing contracts: `create_shopping_list` and `close_shopping_list` are unchanged; `create_household` keeps its signature (optional `store` per catalog section). A list item with another household's product still fails with `23503` (`households_rls.test.sql`), now raised by the store trigger.
  - Not run: this machine has no Docker, so `pnpm db:start`, `pnpm test:db` and `test:integration` can't run. RED (tests before the migration) and GREEN are pending. Next: install Docker Desktop, observe RED with the migration moved aside, then GREEN, then the backfill check against seeded Phase 1 data, then the independent verifier.
- **L5 (2026-10-30), T1 checks:**
  - Docker installed; `pnpm db:start` applies the three migrations cleanly.
  - RED: without the stores migration, `stores.test.sql` fails (`relation "public.stores" does not exist`). GREEN: `pnpm test:db` 47/47 pass (3 files).
  - Backfill on seeded Phase 1 data (two households, a closed list, an open list, an archived product): every household gets Súper/Veterinaria/Química in order, every product and list item lands in Súper, closed items keep `updated_at`, no null `store_id`, all list item triggers enabled afterwards.
  - `pnpm -r test`: domain 30/30, web 44/44 (Onboarding timed out once under the parallel run, 4/4 alone). `test:integration` with local keys: 7/7.
  - Next: independent verifier for risk items 1, 2, 4; then commit T1.
- **L6 (2026-10-30), T1 verifier and correction:**
  - Verifier: S2 and S3 pass; S1 fails on one blocker. Once a store was closed, deleting its list or household failed ("Items of a closed store cannot change"): the item guard still saw the closure during the cascade.
  - Advisory taken in the same correction: an item set back to pending and a store close on two phones could both commit, leaving a closed store with a pending item and the list stuck open for good.
  - Fix: the item guard takes the list row `for share` and skips when the list is gone; the closure guard takes it `for update`, which also covers direct closure inserts.
  - RED: new pgTAP "a household whose list has closed stores can be deleted" failed with the verifier's error. GREEN: `pnpm test:db` 48/48. Race rechecked with two committed sessions in both orders: the second one fails cleanly (close refused with pending items / item change refused in a closed store).
  - `test:integration` 7/7 (it can fail right after `db:reset` while services start; reruns pass).
  - Advisories left open: two members archiving the last two active stores at the same time can leave none active (rare; a product added without a store then fails); `create_household` matches the section `store` name case-sensitively.
