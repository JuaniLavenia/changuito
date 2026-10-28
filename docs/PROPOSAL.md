# Changuito — Product Proposal

A shared web app for households that do one big monthly supermarket trip after their credit cards close. It covers the whole cycle: review stock, build the list, shop together, and close the month.

## 1. Problem

- The household shops once a month, right after the credit card closing date, so the purchase is billed a month later.
- Before going, they check what's left at home and write down what to buy.
- In the store they check items off as they go into the cart.
- Some items don't get bought: the store was out, or the price was too high.
- Today none of this history is kept: no prices, no real consumption, no record of what was skipped and why.

## 2. Core rules

### R1 — Quantity to buy

```
toBuy = max(0, expectedMonthlyConsumption - currentStock)
```

| Product | Expected / month | Stock | To buy |
|---|---|---|---|
| Canned tomato | 4 | 2 | 2 |
| Canned tomato | 4 | 0 | 4 |
| Canned tomato | 4 | 5 | 0 (not listed) |

The suggested quantity can always be edited by hand for that month.

### R2 — Real consumption (Phase 3)

```
consumed = (stockAtPreviousReview + quantityBought) - stockAtCurrentReview
```

- The suggested expected consumption is the average of the last 3 periods.
- It is always editable by hand. The first month is entered by hand.
- Learn from consumption, not from purchases: skipped items ("too expensive") would bias a purchase average.

### R3 — Skipped items

- When the trip closes, every item not bought is marked `unavailable` or `too_expensive`.
- Skipped items are offered for the next month's list.

### R4 — Card closing dates (Phase 2)

- Each card has a rule: `last <weekday> of month` (Visa: last Thursday) or `day N of month` (Naranja: day 27).
- A one-month manual override is allowed, because the real date comes from the statement.
- The **shopping window** opens when a card closes and ends when that month's trip is closed.

## 3. Users and households

- Sign-in with **Google only** (Supabase Auth).
- A user creates a household and gets an **invite code** to share. Others join with that code.
- A user can belong to **several households** and switch between them.
- The creator is **admin**: they can regenerate the invite code and remove members. Codes don't expire.
- Every household is fully isolated (Postgres RLS by membership).

## 4. Features by phase

### Phase 1 — Do the monthly trip (MVP)

1. Google sign-in, create a household, join with an invite code.
2. Base catalog grouped by store section, picked during onboarding and **copied** into the household (fully editable, new products can be added).
3. Products are generic ("Milk"), with an optional **preferred brand**, a unit and an expected monthly consumption.
4. Stock review: enter the current quantity per product to get the suggested list (R1).
5. Shopping mode:
   - Items are ordered by store section.
   - Checking an item off syncs in **real time** across phones.
   - Shows who checked each item ("Milk ✓ — Dad").
   - On check-off you can record the price and, optionally, the brand (autocompleted from history).
6. Close the trip: mark skipped items with a reason and carry them to next month (R3).

### Phase 2 — Cards and reminders

7. Cards with closing rules and monthly overrides (R4). Each trip records the card used.
8. Supermarkets (default: the last one used). Each price is tagged with the supermarket.
9. Promotions per card and supermarket ("Thursdays 25% off with Naranja"), with a suggestion of which card to use today.
10. Reminders:
    - A **web push** the morning after a card closes.
    - An **in-app popup** while the shopping window is open.
    - iOS needs the PWA installed; there's a guided install step.
11. **Offline mode** (PWA): check items off without signal and sync on reconnect.

### Phase 3 — The app learns

12. Expected consumption learned from history (R2), editable.
13. Price history and comparison across supermarkets.
14. Estimated vs. actual total per trip, and spending per month and per card.
15. Ad-hoc purchases between monthly trips. They count for R2 and don't break the monthly list.

## 5. Domain model (draft)

| Entity | Key fields |
|---|---|
| Household | name, inviteCode |
| Membership | userId, householdId, role (`admin` / `member`) |
| Section | name, sortOrder (one order per household) |
| Product | name, sectionId, unit, preferredBrand?, expectedMonthlyConsumption |
| StockReview | date, items: { productId, quantity } |
| ShoppingList | period (month), status (`draft` / `shopping` / `closed`) |
| ListItem | productId, quantity, status (`pending` / `in_cart` / `skipped`), skipReason?, price?, brand?, checkedBy, updatedAt |
| Trip | listId, supermarketId, cardId, closedAt |
| Supermarket | name |
| Card | name, closingRule, overrides: { period, date } |
| Promotion | supermarketId, cardId, weekday, description |
| PriceEntry | productId, supermarketId, brand?, price, date |
| PushSubscription | userId, endpoint, keys |

## 6. Architecture

```
changuito/
├── apps/web/          React + Vite + TS + Tailwind (deployed to Netlify)
├── packages/domain/   Pure TS business rules (R1–R4), no framework or Supabase imports
└── supabase/          Migrations, RLS policies, seed (base catalog), edge functions
```

- **Frontend:** React, Vite, TypeScript, Tailwind, Zustand (UI state), TanStack Query (server state), Radix, lucide-react.
- **Backend:** Supabase: Postgres, Auth (Google), Realtime, RLS, pg_cron plus an Edge Function for push (VAPID).
- **Hexagonal boundaries:** `packages/domain` holds entities and rules. The web app talks to Supabase through repository adapters, so the domain stays testable without a network.
- **Sync:**
  - Realtime subscription on `ListItem` while shopping.
  - Conflicts resolve per item, last write wins (by `updatedAt`).
  - Phase 2 adds an offline mutation queue.
- **Testing:**
  - Vitest for domain rules (test first).
  - Testing Library and MSW for UI flows.
  - RLS covered by SQL tests against the local Supabase.
- **Deploy:**
  - Netlify builds `apps/web`.
  - Supabase migrations are applied from the repo.

## 7. Open points

- Base catalog contents (initial list of products and sections).
- Units supported (`unit`, `kg`, `g`, `l`, `ml`, `pack`?).
- Push timing (the proposal says 9:00 the day after closing).
