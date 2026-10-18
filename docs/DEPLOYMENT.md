# StudySeat: deploying to Vercel + Supabase

This is the checklist for the first live deploy. Items marked **Check on first deploy** could not be proven on a
laptop (they need the real host); everything else was tested against the production build.

## 1. What the app needs at build time

Vercel runs `npm run build` and serves `dist/`. Vite reads these as it builds, so changing one means a **redeploy**.

| Variable | Required | What it is |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL, from Supabase: Project Settings, API. |
| `VITE_SUPABASE_ANON_KEY` | yes | The public anon key, same page. **Never the `service_role` key.** |
| `VITE_UPI_ID` | yes | The UPI ID that receives the ₹199 plan payments (`name@bank`). Without it the Plan page shows "Payments aren't set up yet" and no payment form. |
| `VITE_DATA_MODE` | no | Leave it unset or set `supabase`. A production build defaults to the real backend when it is missing; only an explicit `mock` gives dummy data. |

Set them for the **Production** environment (and for **Preview** too if you want preview links to work).
Node 24 is requested by `package.json` (`engines`), which is Vercel's default.

## 2. Files in the repo that configure the host

- `vercel.json`: sends every path to `index.html` so refreshing `/owner/plan` works, adds security headers
  (Content-Security-Policy, nosniff, no framing, Referrer-Policy, Permissions-Policy, HSTS) and caches the
  hashed files in `/assets` for a year.
- `public/robots.txt`: asks search engines to skip the owner, admin, student, profile and login pages.
- `index.html`: description, theme colour and social-preview text.

The Content-Security-Policy allows scripts from the site itself only, and images, API calls and websockets to
`https://*.supabase.co`. It was tested against the production build on every role's screens with 0 violations.
If you later add analytics, a Supabase custom domain, or any other outside host, add it to the policy first.

## 3. Supabase (use a separate production project)

The current project is the one used for building and testing. For launch, create a new project and keep this one as staging.

1. Create the project (choose the region closest to your users) and put it on a **paid plan before real owners arrive**:
   free projects are paused after about a week of low activity, and paid projects are not.
2. Apply the schema: link the CLI to the new project and run `supabase db push`. The 10 files in `supabase/migrations`
   create the tables, security rules, functions, places, and the photo storage rules. Run them in order; do not edit applied files.
3. Storage: migration 0010 creates the public `LibraryImages` bucket (5 MB, JPEG and PNG) if it does not exist.
4. Authentication, URL configuration: set **Site URL** to the live address and add it (and any preview address you use) to **Redirect URLs**.
5. Authentication, Providers, Google: paste the Google client ID and secret (section 4).
6. Make yourself the admin (section 5).
7. **Reset the database password**, and keep it out of chat and files.

## 4. Google sign-in

In the Google Cloud project that holds the OAuth client:

- Authorised JavaScript origins: add the live site address (for example `https://your-domain`).
- Authorised redirect URIs: add `https://<production-project-ref>.supabase.co/auth/v1/callback`.
- **Publish the consent screen.** While it is in "Testing" only the test users you list can sign in, so a new owner would be refused.
  Check what Google asks for at that point (a privacy-policy link, the app name and the contact email).

Changes on Google's side can take a few minutes to apply.

## 5. First admin

An admin can only be created with SQL (the app cannot grant it). After that person has signed in once with Google:

```sql
update profiles set role = 'admin' where email = 'admin@example.com';
```

Use a different Google account from any owner account: an admin must not also run a library.

## 6. Vercel

1. Import the GitHub repository. The framework is detected as Vite; build command `npm run build`, output `dist`.
2. Add the variables from section 1.
3. Add your domain and follow Vercel's DNS instructions.
4. Deploy, then run the smoke test below.

## 7. Smoke test after the first deploy

1. Open a deep link such as `/discover` in a fresh tab and press refresh. **Check on first deploy:** it must load, not show a 404.
2. Open the site with the browser's developer console. There should be no red errors and no "Content Security Policy" messages.
3. Sign in with Google as a new person: the role chooser appears, then the right home screen.
4. As an owner: list a library with a photo. As admin: approve it. The owner sees "Free trial: 14 days left".
5. On the Plan page, the UPI ID and QR show **your** UPI ID. Submit a real small payment's UTR, verify it as admin, check the new date.
6. As a student on a phone: find the library, request a seat; the owner approves; the student sees the seat.

## 8. Still open before a public launch

- A real support email: the footer and Profile page currently use `support@studyseat.app`.
- The Privacy, Terms and Refund pages are marked as pilot drafts; they need your business details and a read-through.
- No notifications yet: owners and students learn about approvals only when they open the app (the roadmap lists WhatsApp/email as later).
- A social-preview image and a sitemap need the final domain, so they are not added yet.