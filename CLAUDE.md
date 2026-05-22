@AGENTS.md

# Polla Mundial 2026 — Claude Code Guide

## Project Overview
World Cup 2026 prediction app. Participants receive a QR code to log in and submit match score predictions, group qualifiers, and special picks. Admin manages participants, configures scoring rules, and monitors results. Results sync automatically from football-data.org.

## Commands

```bash
pnpm dev          # start dev server (http://localhost:3000)
pnpm build        # production build (always run before committing)
pnpm lint         # ESLint check

pnpm db:push      # push Drizzle schema to Supabase (no migration files)
pnpm db:generate  # generate migration SQL files
pnpm db:studio    # open Drizzle Studio (DB browser)
pnpm db:reset     # ⚠️  WIPE all tables + all Supabase Auth users

pnpm seed         # seed 104 WC 2026 matches + default tournament config
pnpm seed:admin   # create first admin (reads ADMIN_EMAIL / ADMIN_PASSWORD from .env)
```

### Fresh start sequence
```bash
pnpm db:reset     # wipe everything
pnpm db:push      # recreate schema from Drizzle
pnpm seed         # 104 matches + config
pnpm seed:admin   # first admin user
```

## Architecture

### Auth
- `proxy.ts` — Next.js 16 route protection. Uses `@supabase/ssr` to validate sessions. Reads `role` from `user.app_metadata.role` (no DB query).
- `lib/auth/session.ts` — `getSession()` calls `supabase.auth.getUser()`. Returns `{ userId, role, name }`. Role from `app_metadata`, name from `user_metadata`.
- `lib/supabase/server.ts` — `createSupabaseServerClient()` for Server Components / Route Handlers.
- `lib/supabase/admin.ts` — `supabaseAdmin` with `service_role` key. Server-only. Used to create/delete users.
- `/join/[token]` — QR landing page. Looks up `invitations` table → `signInWithPassword(p-{token}@polla.internal, token)` → session set via `@supabase/ssr` cookies.
- Admin login: `supabase.auth.signInWithPassword` with real email. Admin must exist in Supabase Auth with `app_metadata.role = 'admin'`.

#### QR auth mechanic
Each participant has a Supabase Auth user with:
- `email`: `p-{qrToken}@polla.internal` (internal, never exposed)
- `password`: the QR token UUID itself
- `app_metadata.role`: `'participant'`
- `user_metadata.name`: display name

QR token stored in `invitations.token`. Scanning the QR → `/join/{token}` → `signInWithPassword`.

#### First admin setup
Create admin in Supabase Auth via dashboard or:
```ts
supabaseAdmin.auth.admin.createUser({
  email: 'admin@example.com',
  password: 'secure-password',
  email_confirm: true,
  user_metadata: { name: 'Admin' },
  app_metadata: { role: 'admin' },
})
// Then insert into users table with the returned id
```

### Database (Drizzle + Supabase PostgreSQL)
Schema in `lib/db/schema.ts`:
- `users` — participants + admin. `id` matches `auth.users.id` (Supabase Auth UID). `role`: `'admin'|'participant'`. No `qr_token` or `passwordHash` — those are in Supabase Auth.
- `invitations` — QR tokens. `token` UUID → participant login. `used_at` tracks first use. `user_id` references `users.id`.
- `matches` — 104 WC matches. `stage`: `GROUP_STAGE|LAST_32|LAST_16|QUARTER_FINALS|SEMI_FINALS|THIRD_PLACE|FINAL`. `lock_time`: 15 min before match (configurable). `team1_resolved`/`team2_resolved`: false for knockout until bracket is known.
- `predictions` — score predictions per user per match. `points` is null until result entered.
- `group_predictions` — 1st/2nd place per group per user.
- `special_predictions` — champion/finalist/third/top_scorer per user.
- `group_standings` — auto-updated when match results sync.
- `tournament_config` — key-value config editable from admin panel.

### Scoring (`lib/scoring.ts`)
```
Exact score:  points_exact_score  (default 5)
Goal diff:    points_goal_diff    (default 3)
Tendency:     points_tendency     (default 2)
Group 1st:    points_group_winner (default 6)
Group 2nd:    points_group_runner_up (default 4)
Champion:     points_champion     (default 20)
Finalist:     points_finalist     (default 10)
3rd place:    points_third_place  (default 8)
Top scorer:   points_top_scorer   (default 15)
```
All values configurable from `/admin/config`.

### Auto-sync (`lib/football-data/sync.ts`)
- Calls football-data.org API (`/v4/competitions/WC/matches?status=IN_PLAY,PAUSED,FINISHED`)
- Updates match scores + status
- Recalculates prediction points
- Updates group standings
- Triggered by: Vercel cron (hourly) or external cron-job.org (every 5 min) or admin "Sync API" button

### API Routes (`app/api/`)
- `auth/login` — POST email+password → set JWT
- `auth/qr-login` — POST token → set JWT
- `auth/logout` — POST → clear cookie
- `predictions` — GET/POST match predictions (checks lock_time)
- `group-predictions` — GET/POST group predictions
- `special-predictions` — GET/POST special predictions
- `leaderboard` — GET aggregated standings
- `admin/participants` — GET/POST/DELETE participants
- `admin/results/[matchId]` — PATCH manual result override
- `admin/config` — GET/PUT tournament config
- `cron/sync-results` — GET (Vercel cron) / POST (manual) with `x-cron-secret` header

### Route Groups
- `(auth)/login` — public, no layout
- `(participant)/*` — requires valid Supabase session, shows ParticipantNav
- `admin/*` — requires Supabase session with `app_metadata.role: 'admin'`, shows AdminNav

## Key Conventions

### Next.js 16 specifics
- Route protection uses `proxy.ts` (exports `proxy` function), NOT `middleware.ts`
- `cookies()` from `next/headers` is async — always `await cookies()`
- Dynamic params are Promises — always `await params` in route handlers
- `revalidate = 0` on pages that need fresh data each render

### UI
- App is always dark — `className="dark"` on `<html>` tag in `layout.tsx`
- Theme variables in `globals.css`. Primary = gold (`oklch(0.78 0.17 85)`). Background = navy.
- `glass-card` class for cards with glassmorphism effect
- `text-gradient-gold` for gold gradient headings
- `score-input` class for match score number inputs
- Flag emojis via `getFlag(teamName)` from `lib/teams.ts`

### Adding new shadcn components
```bash
pnpm dlx shadcn@latest add <component-name>
```

## Environment Variables
All required in `.env.local` (and in Vercel env vars for production):

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string |
| `DIRECT_URL` | Supabase direct connection (for migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key — server-only, never expose to browser |
| `NEXT_PUBLIC_APP_URL` | Full app URL (e.g. `https://polla.vercel.app`) |
| `FOOTBALL_DATA_API_KEY` | football-data.org free API key |
| `CRON_SECRET` | Random string to protect `/api/cron/sync-results` |

## World Cup 2026 Format
- 48 teams, 12 groups (A–L) of 4 teams each
- Group stage: 72 matches (6 per group, round-robin)
- Advance: top 2 each group (24) + 8 best 3rd-place teams = 32 teams
- Knockout: R32 (16) → R16 (8) → QF (4) → SF (2) → 3rd place (1) → Final (1) = 32 matches
- Total: 104 matches | Jun 11 – Jul 19, 2026

## Common Tasks

### Add a participant (via code)
```typescript
await db.insert(users).values({
  name: 'Juan',
  role: 'participant',
  qrToken: randomUUID(),
  avatarColor: getAvatarColor(idx),
})
```

### Recalculate all points for a match
Call `PATCH /api/admin/results/[matchId]` with `{ score1, score2 }` — recalculates all predictions automatically.

### Reseed matches (if DB is empty)
```bash
pnpm seed
```
Fetches from `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json` and inserts with `onConflictDoNothing`.
