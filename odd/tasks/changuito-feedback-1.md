# Changuito — Feedback round 1

Objective: apply the fixes and UX changes the user found while testing the deployed Phase 1 app. One branch and one PR per stage, each based on `main`. Delivery: ask-on-risk. Test runner: Vitest (`pnpm --filter @changuito/web test`, `test:integration` against local Supabase).

## Specs

- **S1 — Household persistence (stage 1).** The user stays in their household across reloads and visits. An auth lookup failure must never be treated as "user has no households". User: "no me mantiene en el hogar pero si la sesión de google, tuve que volver a ingresar el codigo de invitacion."
- **S2 — Installable app (stage 2).** The app can be installed on Android and iOS (PWA). User: "Añadir para que se pueda instalar la app en Android y los" (confirmed: "Android y iOS").
- **S3 — Favicon (stage 2).** User: "Añadir un favicon".
- **S4 — Palette (stage 2).** User: "No me gusta la paleta de colores" / "Probar con: #16A34A, #22C55E, #DCFCE7, #F3F4F6, #1F2937". Open question: dark mode handling.
- **S5 — Mobile buttons (stage 3).** User: "En mobile habría que mover un poco más arriba los botones, porque el flotante de netlify molesta y no deja hacer click."
- **S6 — Page descriptions (stage 3).** User: "En cada una de las landings agregar una pequeña descripción que indique que hacer, por ejemplo, en Catálogo: indica cuánto consumis aproximadamente de cada item..." Texts proposed by the assistant, reviewed by the user.
- **S7 — Edit product on mobile (stage 3).** User: "Editar producto queda muy abajo cuando se abre en Mobile."
- **S8 — Invite code on home (stage 4).** User: "No me gusta que en código de invitación se vea en la pantalla de inicio, se debería poder ocultar o ponerlo como desplegable". Assumption: collapsible, collapsed by default.
- **S9 — Home summary (stage 4).** User: "La pantalla de inicio debería tener un tipo resumen". Open question: summary contents.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1 | inline | done (browser check pending) | `9033cf7` on `fix/household-persistence`; risk item 2, independent verifier: no blockers; RDD off |
| T2 | S2–S4 | inline | pending | |
| T3 | S5–S7 | inline | pending | |
| T4 | S8–S9 | inline | pending | |

## Log

- **L1 (2026-10-28) — user request, verbatim:**
  > * Añadir para que se pueda instalar la app en Android y los
  > * Añadir un favicon
  > * No me gusta la paleta de colores
  > * Probar con:
  > * #16A34A, #22C55E, #DCFCE7, #F3F4F6, #1F2937
  > * No me gusta que en código de invitación se vea en la pantalla de inicio, se debería poder ocultar o ponerlo como desplegable
  > * La pantalla de inicio debería tener un tipo resumen
  > * En mobile habría que mover un poco más arriba los botones, porque el flotante de netlify molesta y no deja hacer click.
  > * En cada una de las landings agregar una pequeña descripción que indique que hacer, por ejemplo, en Catálogo: indica cuánto consumis aproximadamente de cada item...
  > * Editar producto queda muy abajo cuando se abre en Mobile.
  >
  > * no me mantiene en el hogar pero si la sesión de google, tuve que volver a ingresar el codigo de invitacion.
- **L2 (2026-10-28) — user:** "sí, Android y iOS". Plan accepted in 4 stages; "dale, arrancá con la etapa 1."
- **L3 — T1 analysis.** Membership persists in the DB (`join_household` is idempotent, RLS OK). `HouseholdRepository.list()` swallowed the `supabase.auth.getUser()` result and returned `[]` when it yielded no user (network call; can fail on reload / token refresh / right after the OAuth redirect). `[]` routes the user to `/onboarding`, where re-entering the code "fixes" it. Fix: resolve the user from the local session and throw instead of returning `[]`, so the query errors (and retries) instead of routing to onboarding.
- **L4 — T1 evidence.** RED: new integration test "fails instead of reporting no households when there is no signed-in user" failed (list resolved instead of rejecting). GREEN: `test:integration` 6/6, `test` 33/33, typecheck and lint clean. Pending: browser check of the real Google flow on the Netlify deploy preview (local Supabase has no Google OAuth credentials).
- **L5 — T1 verification.** Independent verifier: security OK (RLS enforces membership via `auth.uid()`; the client id is only a filter), behavior OK (a thrown `list()` retries once, then shows the error screen, never `/onboarding`), no other callers rely on `[]`. Advisory: the `['households']` query key is not scoped to the user; not reachable today because Google sign-in always does a full-page redirect. Next: T2 (S2–S4), starting with the dark-mode question.
