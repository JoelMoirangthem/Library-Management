# StudySeat: deploying to Render + Supabase

StudySeat is a static site (a Vite build) on Render, talking to Supabase for the database, login and photos.
Items marked **Check on first deploy** cannot be proven on a laptop (they need the real host); everything else was
tested against a clean production build, including the headers and rules in `render.yaml`.

## 1. What the build needs

Render runs `npm ci && npm run build` and serves `dist/` from its CDN. Vite reads these variables **while building**,
so changing one means a redeploy (Render does this when you save the variable).

| Variable | Required | What it is |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL, from Supabase: Project Settings, API. |
| `VITE_SUPABASE_ANON_KEY` | yes | The public anon key, same page. **Never the `service_role` key.** |
| `VITE_UPI_ID` | yes | The UPI ID that receives the ₹199 plan payments (`name@bank`). Without it the Plan page shows "Payments aren't set up yet" and no payment form. |
| `VITE_SUPPORT_EMAIL` | no | The address shown in the footer, legal pages and account page. If blank, the app uses its built-in default. |
| `VITE_DATA_MODE` | no | `render.yaml` sets it to `supabase`. A production build also defaults to the real backend when it is missing; only an explicit `mock` gives dummy data. |

The database **password** is different: it is a real secret. It lives only in your local `.env` as `SUPABASE_DB_PASSWORD` (used by `npm run db:push` / `db:query`) and must never be added to Render or `render.yaml`; the website does not need it.

The variables above are not secrets (every visitor's browser receives them), but the UPI ID and keys are still kept out of git:
`render.yaml` marks them `sync: false`, so Render asks for the values in the dashboard.

Node: `package.json` requests `24.x` (`engines`), and Render's current default is 24.x as well.

## 2. Files in the repo that configure the host

- `render.yaml` (a Render Blueprint, checked against Render's published schema):
  - the static site: build command, publish folder `./dist`, the variables above;
  - a rewrite rule `/*` to `/index.html`, so refreshing `/owner/plan` works. Render serves a real file when one exists at
    the path, so the hashed files in `/assets` are never rewritten;
  - security headers (Content-Security-Policy, nosniff, Referrer-Policy, Permissions-Policy, HSTS) and a one-year cache for `/assets/*`.
- `public/robots.txt`: asks search engines to skip the owner, admin, student, profile and login pages.
- `index.html`: description, theme colour and social-preview text.

The Content-Security-Policy allows scripts from the site itself only, and images, API calls and websockets to
`https://*.supabase.co`. It produced 0 violations across the owner, student and admin screens. If you later add
analytics, a Supabase custom domain, or any other outside host, add it to the policy in `render.yaml` first.

## 3. Supabase (use a separate production project)

The current project is the one used for building and testing. For launch, create a new project and keep this one as staging.

1. Create the project (choose the region closest to your users) and put it on a **paid plan before real owners arrive**:
   free projects are paused after about a week of low activity, and paid projects are not.
2. Apply the schema: set `VITE_SUPABASE_URL` and `SUPABASE_DB_PASSWORD` in your local `.env` (and `SUPABASE_DB_HOST` if the project is not in Sydney), then run `npm run db:push`. The 11 files in `supabase/migrations`
   create the tables, security rules, functions, places, photo storage rules and hardening. Run them in order; do not edit applied files.
3. Storage: migration 0010 creates the public `LibraryImages` bucket (5 MB, JPEG and PNG) if it does not exist.
4. Authentication, URL configuration: set **Site URL** to the live address (your `onrender.com` address or your own domain)
   and add it, plus any preview address you use, to **Redirect URLs**.
5. Authentication, Providers, Google: paste the Google client ID and secret (section 4).
6. Make yourself the admin (section 5).
7. **Reset the database password**, and keep it out of chat and files.

## 4. Google sign-in

In the Google Cloud project that holds the OAuth client:

- Authorised JavaScript origins: add the live site address.
- Authorised redirect URIs: add `https://<production-project-ref>.supabase.co/auth/v1/callback`.
- **Publish the consent screen** (Google Auth Platform, Audience, Publish app), so the app is "In production" and open to any Google account.
  Google's documentation says an app that asks only for name, email and profile (which is all StudySeat asks for) is not limited to the listed
  test users and its sign-ins do not expire after 7 days even in "Testing"; publishing is still the safe setting for real users and for
  showing your app name. **Prove it, don't assume it:** after publishing, sign in with a Google account that is not yours and not on the test-user list.

Changes on Google's side can take a few minutes to apply.

## 5. First admin

An admin can only be created with SQL (the app cannot grant it). After that person has signed in once with Google:

```sql
update profiles set role = 'admin' where email = 'admin@example.com';
```

Use a different Google account from any owner account: an admin must not also run a library.

## 6. Render

1. Push the branch you want to deploy to GitHub (`render.yaml` sets `branch: main`, so merge into `main` first).
2. In the Render dashboard choose **New**, then **Blueprint**, connect the repository, and let Render read `render.yaml`.
3. Enter the three required values when asked (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_UPI_ID`).
4. Wait for the first deploy, open the `onrender.com` address, then add your own domain under Settings, Custom Domains and follow the DNS instructions.
   Render redirects HTTP to HTTPS and issues the certificate itself.

## 6b. Security checks (before the first deploy, and before every later one)

1. **`npm run security:check`** reads the live database and asserts 10 rules: every table has row-level security; strangers can read only cities and areas; users cannot write sensitive columns (role, ownership, approval, money, expiry) directly; strangers can run only an approved list of functions; every privileged function pins its search path; new tables are closed by default; the photo bucket accepts only small JPEG/PNG files; storage never serves strangers or allows overwriting; and the live API returns no private table to a stranger. It prints the failing rule and what to fix. It needs `SUPABASE_DB_PASSWORD` in `.env`, and is read-only.
2. **Turn off the Email sign-in provider** (Supabase dashboard, Authentication, Sign In / Providers, Email). StudySeat only has a Google button, but the project also accepts email-and-password sign-ups through the API: this was tested, and Supabase's built-in mail limit throttled the attempt (it was not blocked). Disable only the **Email provider**. Do **not** switch off "Allow new users to sign up": that setting applies to every login method, so it would also stop brand-new people signing in with Google. Anonymous sign-ins are already off (tested).
3. Keep **Confirm email** on while the Email provider exists, so an address must be proven before a session is issued.

Note: scripted tests that log in with a password (like the ones used to check this project) need the Email provider switched back on temporarily.
## 7. Smoke test after the first deploy

GitHub already runs the type check, lint, tests and a build on every pull request (`.github/workflows/ci.yml`); the steps below are for the things only the real host can show.

1. **Check on first deploy:** open `/discover` in a fresh tab and press refresh. It must load, not show a 404. (This is the rewrite rule.)
2. **Check on first deploy:** in the browser's developer tools, Network tab, open the first request and confirm the response has
   `content-security-policy` and `x-content-type-options`. The console should show no red errors.
3. Sign in with Google as a new person: the role chooser appears, then the right home screen.
4. As an owner: list a library with a photo. As admin: approve it. The owner sees "Free trial: 14 days left".
5. On the Plan page the UPI ID and QR show **your** UPI ID. Submit the UTR of a real small payment, verify it as admin, check the new date.
6. As a student on a phone: find the library, request a seat; the owner approves; the student sees the seat.

## 8. Still open before a public launch

- The Privacy, Terms and Refund pages are marked as pilot drafts; they need your business details and a read-through.
- No notifications yet: owners and students learn about approvals only when they open the app (the roadmap lists WhatsApp/email as later).
- A social-preview image and a sitemap need the final domain, so they are not added yet.