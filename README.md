# StudySeat

Library owners manage their study library (seats, students, fees, expiry). Students find a library by city and area and request a seat. Owners get 14 days free, then ₹199/month.

Stack: React + Vite + TypeScript + Tailwind on Vercel, Supabase (Auth, Postgres with RLS, Storage). No custom backend, no Docker.

## Setup

Requires Node.js 24+ and Git.

```bash
npm install
cp .env.example .env     # then fill in your Supabase URL and anon key
npm run dev              # http://localhost:5173
```

Only the public anon key belongs in `.env`. Never use the `service_role` key in this app. `.env` is git-ignored.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | Lint with oxlint |

## Docs

See `docs/`: `REQUIREMENTS.md`, `DATABASE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`.
