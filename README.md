# StudySeat

Library owners manage their study library (seats, students, fees, expiry). Students find a library by city and area and request a seat. Owners get 14 days free, then ₹199/month.

Stack: React + Vite + TypeScript + Tailwind on Render (static site), Supabase (Auth, Postgres with RLS, Storage). No custom backend, no Docker.

## Setup

Requires Node.js 24+ and Git.

```bash
npm install
npm run dev              # http://localhost:5173
```

The app runs in **dummy mode** by default: everything happens in your browser on fake data (saved in localStorage), so no keys are needed. Use the **Demo** button (bottom-right) to switch between owner, student and admin accounts, move the date forward to test trial expiry and renewals, force loading and error screens, or reset the data.

For the real backend (Supabase), copy `.env.example` to `.env`, set `VITE_DATA_MODE=supabase` and fill in the project URL and anon key. Only the public anon key belongs there. Never use the `service_role` key in this app. `.env` is git-ignored. The database is built by the files in `supabase/migrations`. Put the database password in `.env` as `SUPABASE_DB_PASSWORD` (plain text), then run `npm run db:push`; the password is read from `.env` and never printed. Sign-in is Google; set the Google OAuth client and the allowed redirect URLs in the Supabase dashboard. Set `VITE_UPI_ID` to the UPI ID that receives the plan payments (for example `name@bank`); in Supabase mode the Plan page refuses to show a payment screen without it. Set `VITE_DATA_MODE=mock` to go back to dummy data.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | Lint with oxlint |
| `npm run db:push` | Apply new database migrations (needs `SUPABASE_DB_PASSWORD` in `.env`) |
| `npm run security:check` | Check the live database against the 12 safety rules |
| `npm run admin:set-password` | Create the administrator or change their password (asks in the terminal, never in chat) |
| `npm run db:push` | Apply new files from `supabase/migrations` to the database named in `.env` |
| `npm run db:query -- "select 1"` | Run one SQL statement against that database |
| `npm run security:check` | Check the live database against the safety rules (read-only). Run it before every deploy. |

## Docs

See `docs/`: `REQUIREMENTS.md`, `DATABASE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`, `DEPLOYMENT.md` (going live on Render and Supabase).
