# StudySeat

Library owners manage their study library (seats, students, fees, expiry). Students find a library by city and area and request a seat. Owners get 14 days free, then ₹199/month.

Stack: React + Vite + TypeScript + Tailwind on Vercel, Supabase (Auth, Postgres with RLS, Storage). No custom backend, no Docker.

## Setup

Requires Node.js 24+ and Git.

```bash
npm install
npm run dev              # http://localhost:5173
```

The app runs in **dummy mode** by default: everything happens in your browser on fake data (saved in localStorage), so no keys are needed. Use the **Demo** button (bottom-right) to switch between owner, student and admin accounts, move the date forward to test trial expiry and renewals, force loading and error screens, or reset the data.

Later, for Supabase mode, copy `.env.example` to `.env` and fill in the URL and anon key. Only the public anon key belongs there. Never use the `service_role` key in this app. `.env` is git-ignored.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | Lint with oxlint |

## Docs

See `docs/`: `REQUIREMENTS.md`, `DATABASE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`.
