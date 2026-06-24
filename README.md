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

1. **Automatic (page-driven)** — every phone polls `/api/state` every 15s. While
   the match is live, that endpoint checks API-Football for your fixture and
   records the final score once the status is `FT`/`AET`/`PEN`. Calls to the
   football API are throttled to once every 3 minutes (shared across all
   visitors) so the free-tier 100/day quota is never exceeded. The `/admin` page
   also has a one-tap "Sincronizar ahora" button (forces an immediate check).
2. **Manual backup** — the `/admin` page lets you type the final score by hand.
   This always works, even with no API key.

Because the family is watching the page at the final whistle, the reveal
triggers itself — no cron job or paid plan required. The winner appears for
everyone within ~15s of the score being recorded.

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
3. Add the same env vars under **Project → Settings → Environment Variables**.
4. Deploy. Share the URL with the family.

> **No cron / no paid plan needed.** The result sync is driven by the family
> page itself (see "How the result reaches the app" above), so the free Hobby
> plan is enough. If the auto-sync ever lags, tap **"Sincronizar ahora"** on the
> admin page or type the final score manually — the reveal is instant either way.

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
