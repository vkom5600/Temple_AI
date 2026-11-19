# Putting Temple AI online

This is how to run Temple AI for real, on a public web address, instead of on a laptop.
It takes about 30 minutes the first time. You need a GitHub account with access to this
repository and a card for the hosting bill (about £15 a month on the plan below).

## What you get

- **One web address** (for example `https://temple-ai.onrender.com`) that runs both the
  website and the API.
- **One database** (Postgres), backed up by the host.
- The scheduled jobs run on their own: repeating tasks, the closing check, hourly overdue
  reminders (7am–9pm UK time) and the nightly report at 00:05.

## Before you start: decide these

| Decision | Who | Notes |
|---|---|---|
| Who owns the hosting account and pays | Rao garu / committee | Render bills monthly. Start on a personal account and transfer later if needed. |
| The chairman's sign-in email and password | Chairman | Password at least 12 characters. Changed later in the app. |
| Real emails or not | Committee | Without email settings, emails are only written to the log. Gmail, Microsoft 365 or a service like Brevo all work. |
| Temple AI (Claude) on or off | Committee | Optional. Add an Anthropic API key to switch it on; without it the built-in answers and planner are used. |

## Steps (Render)

1. Sign in at **render.com** with GitHub.
2. **New → Blueprint**, choose this repository and the branch to run (`main` once merged).
   Render reads `render.yaml` and sets up the web service and the database.
3. When it asks for the values marked *sync: false*, fill in:
   - `INITIAL_CHAIRMAN_NAME`, `INITIAL_CHAIRMAN_EMAIL`, `INITIAL_CHAIRMAN_PASSWORD`
   - `FRONTEND_URL`: leave blank for now; set it to the site's address after the first deploy.
   - The optional ones (`ANTHROPIC_API_KEY`, `SMTP_*`, `EMAIL_FROM`) can be added any time later.
4. Click **Apply**. The first build takes a few minutes. The database tables are created
   automatically on every start (`npm run db:migrate`), so updates need nothing extra.
5. Create the chairman account once: in the web service, open **Shell** and run
   ```
   cd backend && npm run create-admin
   ```
6. Open the site's address, sign in as the chairman, then:
   - **People → Add person** for the committee, staff and volunteers (or open the
     **Sign-up window** and share the link / QR code).
   - **Calendar → Spaces**: check the halls and rooms (the committee said 10 in all).
   - **Calendar → Festivals**: add this year's festival days, confirmed with the priest.
   - **Settings**: check the closing time, reminders and nightly report.
7. Set `FRONTEND_URL` to the site's address (Environment tab) and redeploy.

The demo accounts and demo data are **not** created online: `db:seed` and `db:reset`
refuse to run when `NODE_ENV=production`.

## Updating

Push to the branch Render watches. It rebuilds and restarts by itself; new database
changes run on start.

## Other hosts

Any host that runs Node 20+ and Postgres works the same way:

- Build: `cd frontend && npm ci && npm run build && cd ../backend && npm ci`
- Start: `cd backend && npm run db:migrate && node server.js`
- Environment: `NODE_ENV=production`, `DATABASE_URL`, `DB_SSL=true`, a long random
  `JWT_SECRET` (32+ characters), `TEMPLE_TIMEZONE=Europe/London`, plus the optional ones above.

Neon or Supabase for the database with Railway for the app also works.

## Checks before going live

- [ ] `npm test` in `backend` passes (19 API tests, uses its own test database).
- [ ] `npm run check:layout` in `frontend` is clean (run against a local copy).
- [ ] The chairman can sign in on the live site; a committee member and a staff phone too.
- [ ] Festival dates confirmed with the priest (seeded examples are marked "date to confirm" and
      are only in demo data).
- [ ] Someone knows how to restore the database backup (Render dashboard → database → Backups).
