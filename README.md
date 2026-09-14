# Techloom.ai MERN Assessment — Dulina033

Repository: https://github.com/Dulina033/<your-repo-name>

This repo contains two full MERN-stack tasks, each with its own `server` (Express + MongoDB/Mongoose) and `client` (React + Vite):

```
/task-01   POS Order & Inventory System
/task-02   E-Commerce Checkout & Payment System
```

Both projects are run **locally** (no deployment) — see setup steps below.

---

## Tech stack

- **Backend:** Node.js, Express, Mongoose (MongoDB)
- **Frontend:** React 18 (Vite)
- **Concurrency control:** MongoDB multi-document transactions (`mongoose.startSession()` + `withTransaction`) combined with atomic conditional updates (`findOneAndUpdate({ stock: { $gte: qty } }, { $inc: { stock: -qty } })`) — this is what prevents overselling.
- **Reservation expiry:** a background sweeper (`setInterval`, every 15s) plus inline expiry checks on payment, so abandoned checkouts always release stock within seconds of the 5-minute TTL.

> **Important:** MongoDB transactions require a **replica set** (a single standalone `mongod` does not support them). The easiest way to get this for free is a free-tier **MongoDB Atlas** cluster (Atlas clusters are replica sets by default). If you run MongoDB locally, initialize it as a single-node replica set (`mongod --replSet rs0` then `rs.initiate()` in the mongo shell).

---

## Prerequisites

- Node.js 18+
- A MongoDB connection string (Atlas free tier recommended, see note above)

---

## Setup — Task 01 (POS Order & Inventory System)

```bash
cd task-01/server
cp .env.example .env      # then edit MONGO_URI
npm install
npm run dev                # runs on http://localhost:5001
```

```bash
cd task-01/client
npm install
npm run dev                # runs on http://localhost:5173, proxies /api to :5001
```

Open http://localhost:5173.

### How to test each feature

| Feature | How to test |
|---|---|
| Product CRUD | "Products" tab — add/edit/delete products, stock updates live |
| Overselling prevention | Set a product's stock to 1, open two browser tabs, add it to cart in both, click checkout in both at roughly the same time — only one succeeds, the other gets "Insufficient stock" |
| Stock reservation + 5-min expiry | Checkout an item, watch the countdown on the "Orders" tab; if you don't pay within 5 minutes the order flips to `Expired` and stock is restored (or wait/lower `RESERVATION_TTL_MINUTES` in `.env` to test faster, e.g. `RESERVATION_TTL_MINUTES=0.2` for 12s) |
| Mock payment: success / failure / timeout | On a `Reserved` order, use the "Pay (success/fail/timeout)" buttons — success → `Paid`; failure → `Failed` + stock restored; timeout → `Expired` + stock restored |
| Duplicate payment/order protection | Rapidly click "Pay" twice — the second request is rejected with 409 (payment lock); resubmitting the same cart is deduped via `idempotencyKey` |
| Order cancellation | Cancel a `Reserved` or `Paid` order — stock is restored |
| Order lifecycle / statuses | Visible as colored badges: Pending, Reserved, Paid, Cancelled, Expired, Failed |

---

## Setup — Task 02 (E-Commerce Checkout & Payment System)

```bash
cd task-02/server
cp .env.example .env      # then edit MONGO_URI (use a different DB name than task-01)
npm install
npm run dev                # runs on http://localhost:5002
```

```bash
cd task-02/client
npm install
npm run dev                # runs on http://localhost:5174, proxies /api to :5002
```

Open http://localhost:5174. Enter any username (no real auth — this is a demo user id used to scope carts/order history).

### How to test each feature

| Feature | How to test |
|---|---|
| Product search & filters | "Shop" tab — search box, category dropdown, max price filter |
| Product details view | Click "Details" on any product |
| Cart & checkout | Add items, go to "Cart", adjust quantities, click "Reserve stock & Checkout" |
| Stock reservation | Same TTL-based reservation as task-01, visible on the "Order History" tab |
| Mock payment gateway | Pay (success/fail/timeout) buttons on a `Reserved` order |
| Duplicate payment/checkout protection | Same idempotency-key + payment-lock mechanism as task-01 |
| Refund simulation | Cancel a `Paid` order ("Cancel & refund") or use "Refund only" without cancelling |
| Order history | "Order History" tab, scoped to the current username, shows all past/ current orders and statuses |

---

## Environment variables

Both `task-01/server/.env` and `task-02/server/.env` (copy from `.env.example`):

```
PORT=5001                       # 5002 for task-02
MONGO_URI=<your MongoDB connection string>
RESERVATION_TTL_MINUTES=5
```

---

## Notes on design decisions

- **Why `stock` alone (no separate "reserved" field)?** `Product.stock` always represents *currently available* units. Reserving = atomically decrementing it (with a `$gte` guard so it can never go negative or double-sell). Releasing (on cancel/expire/fail) = incrementing it back. This keeps the invariant "available stock is always correct" true with a single field and a single atomic operation per line item, instead of needing to reconcile two counters.
- **Why `idempotencyKey` / `paymentIdempotencyKey`?** Real front-ends retry on network blips. A unique index on `idempotencyKey` plus an atomic `paymentLock` flip means retries and double-clicks are safely deduped rather than creating duplicate orders/charges.
- **Why a sweeper *and* inline expiry checks?** The inline check (in the payment controller) guarantees correctness the instant a stale payment attempt comes in; the sweeper is a safety net for reservations nobody ever returns to.

---

## Opening in VS Code

```bash
git clone https://github.com/Dulina033/<your-repo-name>.git
cd <your-repo-name>
code .
```

Then open two integrated terminals per task (one for `server`, one for `client`) and run `npm run dev` in each, as described above.
