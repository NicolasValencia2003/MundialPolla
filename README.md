# Polla Mundial — Colombia vs RD Congo 🏆⚽

A tiny family prediction pool. Everyone opens the page on their phone, types their
name and their **full-time score** prediction. Picks stay hidden from everyone
until the final whistle. When the real result lands, the app reveals the winner:
the **exact score** if anyone nailed it, otherwise the **closest** prediction
(by total goal distance). Ties become co-winners.

Built with **Next.js + Supabase**, deploys to **Vercel**.

---

## How the winner is decided

- Exact score (distance 0) always wins.
- Otherwise: `distance = |yourHome − realHome| + |yourAway − realAway|`. Lowest wins.
- Example, real result `2–1`: a `1–1` guess has distance 1; `3–0` has distance 2; `2–0` has distance 1.
- Several people tied at the lowest distance → they all win.

## How the result reaches the app (two paths, both built in)

1. **Automatic** — `/api/sync` polls API-Football for your fixture and writes the
   final score once the match status is `FT`/`AET`/`PEN`. A Vercel Cron hits it
   every 2 minutes during the match. The admin page also has a one-tap
   "Sincronizar ahora" button.
2. **Manual backup** — the `/admin` page lets you type the final score by hand.
   This always works, even with no API key.

Either way, every phone polls `/api/state` every 15 seconds, so the winner
appears for the whole family within ~15s of the score being set.

---

## Setup (about 15 minutes)

### 1. Supabase (storage)
1. Create a project at https://supabase.com (free).
2. Open **SQL Editor → New query**, paste the contents of [`supabase_schema.sql`](./supabase_schema.sql), and **Run**.
   - Edit the `kickoff` time in that file to the real local kickoff first (it's stored in UTC), or set it later from the admin page.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — it never touches the browser)

### 2. Football API (optional, for automatic result)
1. Sign up free at https://www.api-football.com/ and copy your API key → `FOOTBALL_API_KEY`.
2. Find the fixture id for Colombia vs RD Congo and set `FOOTBALL_FIXTURE_ID`.
   - Quick way: `curl -s "https://v3.football.api-sports.io/fixtures?date=2026-06-23" -H "x-apisports-key: YOUR_KEY"` and find the match in the JSON (`response[].fixture.id`).
   - Skip this entirely if you'd rather just type the score on the admin page.

### 3. Environment variables
Copy `.env.local.example` to `.env.local` and fill it in. Set `ADMIN_PASSWORD`
to anything you like, and `CRON_SECRET` to a long random string.

### 4. Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000 (and http://localhost:3000/admin).

### 5. Deploy to Vercel
1. Push this folder to a GitHub repo.
2. Import it at https://vercel.com/new.
3. Add the same env vars under **Project → Settings → Environment Variables**
   (including `CRON_SECRET` — Vercel automatically sends it as the cron's
   `Authorization: Bearer` token).
4. Deploy. Share the URL with the family.

> **Note on Vercel Cron:** the Hobby (free) plan may run crons less often than
> every 2 minutes. If auto-sync seems slow, just tap **"Sincronizar ahora"** on
> the admin page once the match ends, or type the final score manually — the
> reveal is instant either way.

---

## Match-day checklist
- [ ] Schema run in Supabase, kickoff time set (SQL or admin page).
- [ ] Env vars set in Vercel.
- [ ] Family has the link and submitted predictions before kickoff.
- [ ] After the final whistle: confirm the score auto-synced, or set it on `/admin`.

## Files
- `app/page.tsx` — the family-facing page (form, hidden picks, reveal).
- `app/admin/page.tsx` — admin controls (manual score, sync, settings).
- `app/api/*` — server routes; all DB access happens here with the service-role key.
- `lib/scoring.ts` — the closest-prediction logic.
- `supabase_schema.sql` — database tables + seed.
