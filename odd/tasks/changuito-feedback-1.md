# Changuito — Feedback round 1

Objective: apply the fixes and UX changes the user found while testing the deployed Phase 1 app. One branch and one PR per stage, each based on `main`. Delivery: ask-on-risk. Test runner: Vitest (`pnpm --filter @changuito/web test`, `test:integration` against local Supabase).

## Specs

- **S1 — Household persistence (stage 1).** The user stays in their household across reloads and visits. An auth lookup failure must never be treated as "user has no households". A member who ends up on `/onboarding` without asking for it is taken home, and while households load the app shows "Cargando tu hogar" (user, L6). User: "no me mantiene en el hogar pero si la sesión de google, tuve que volver a ingresar el codigo de invitacion."
- **S2 — Installable app (stage 2).** The app can be installed on Android and iOS (PWA). User: "Añadir para que se pueda instalar la app en Android y los" (confirmed: "Android y iOS").
- **S3 — Favicon (stage 2).** User: "Añadir un favicon".
- **S4 — Palette (stage 2).** User: "No me gusta la paleta de colores" / "Probar con: #16A34A, #22C55E, #DCFCE7, #F3F4F6, #1F2937". Light only (user, L9).
- **S5 — Mobile buttons (stage 3).** User: "En mobile habría que mover un poco más arriba los botones, porque el flotante de netlify molesta y no deja hacer click."
- **S6 — Page descriptions (stage 3).** User: "En cada una de las landings agregar una pequeña descripción que indique que hacer, por ejemplo, en Catálogo: indica cuánto consumis aproximadamente de cada item..." Texts proposed by the assistant, reviewed by the user.
- **S7 — Edit product on mobile (stage 3).** User: "Editar producto queda muy abajo cuando se abre en Mobile."
- **S8 — Invite code on home (stage 4).** User: "No me gusta que en código de invitación se vea en la pantalla de inicio, se debería poder ocultar o ponerlo como desplegable". Assumption: collapsible, collapsed by default.
- **S9 — Home summary (stage 4).** User: "La pantalla de inicio debería tener un tipo resumen". Open question: summary contents.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1 | inline | done (verified on deploy preview) | PR #9; `9033cf7`, `9422757` on `fix/household-persistence`; risk item 2, independent verifier: no blockers; RDD off |
| T2 | S2–S4 | inline | done (preview check pending) | branch `feat/pwa-palette` |
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
- **L6 (2026-10-28) — user, verbatim:** "Al entrar en la app me dejaba en el /onboarding, me fije en el network y si traia todo ok, pero no me llevaba al inicio, quedaba ahi. Entonces borre en la url el /onboarding y me cargo el hogar correctamente. Pienso que para que no pase eso, despues de iniciar sesion con google deberia aparecer un loading tipo "Cargando tu hogar", hasta que cargue todo y te deje en el inicio."
- **L7 — T1b.** Second half of S1: `/onboarding` never sent a member back home once households loaded. Fix: a member reaching `/onboarding` without the "add another household" router state (set by the header "+" link) is redirected to `/`; the households loading spinner shows "Cargando tu hogar…". RED: 2 new AppRoutes tests failed; the "+" link test (preserved behavior) passed before and after. GREEN: unit 30/30 (+6 integration skipped, no keys exported), typecheck and lint clean.
- **L8 (2026-10-28) — T1 browser check on https://deploy-preview-9--michanguito.netlify.app/** (after the user added `https://*--michanguito.netlify.app/**` to Supabase Redirect URLs). User: Google sign-in went straight home. Assistant in Chrome with the user's session: `/onboarding` redirected to `/` (household loaded); reloads of `/` and `/catalogo` kept the household; the header "+" link still opens onboarding. Not run: the offline check (DevTools network throttling is not available to the extension).
- **L9 (2026-10-28) — user, verbatim:** "listo! mergeado y deployado. Que quede siempre en modo claro"
- **L10 — T2.** Chrome install criteria (web.dev/articles/install-criteria): HTTPS + manifest with name, 192/512 icons, start_url, display; no service worker required, so none was added (no dependency, no stale-cache risk; no offline mode). Icons: lucide cart on #16A34A, rounded "any" + full-bleed maskable + 180px apple-touch-icon, PNGs drawn by `apps/web/scripts/render-icons.ps1` (System.Drawing; headless Edge produced no output). Palette mapping: primary/success #16A34A, ring #22C55E, secondary/accent #DCFCE7, background/muted #F3F4F6, foreground #1F2937; supporting neutrals #4B5563 (muted text) and #E5E7EB (borders); dark-mode block removed, `color-scheme: light`. Contrast note: white on #16A34A is ~3.3:1 (below WCAG AA 4.5:1 for small text). RED: `install.test.ts` 2 failing; GREEN: unit 32/32, lint clean, build ok, dist contains manifest and icons.
- **L11 (2026-10-28) — user, verbatim:** "lo veo todo bien! ahi lo mergeo y te aviso" (palette accepted as given, including the ~3.3:1 button contrast); then "listo! mergeado y deployado. sigamos".
- **L12 — T3 (S5, S7).** The "flotante de netlify" is the "Powered by Netlify" badge iframe (`#nl-badge-frame`, ~197×64 px, fixed bottom-right) on production; deploy previews also show Netlify's 48 px toolbar at the bottom. Not hidden (third-party content). Instead, CSS vars in `index.css`: `--badge-clearance` (4rem below `sm`, 0 from `sm` up), `--bottom-clearance` (+ safe-area inset, needed since stage 2 set `viewport-fit=cover`), `--bottom-nav-height`; the tab bar, the sticky action bars (stock, shopping, onboarding) and `main` padding use them. The shared Dialog opens anchored at the top on phones (`inset-x-3 top-3`) instead of as a bottom sheet. No meaningful RED in jsdom for layout: checked by build output (utilities generated), unit 32/32, lint clean; visual check pending on the deploy preview at phone width.
