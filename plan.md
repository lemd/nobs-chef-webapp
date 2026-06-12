# Nobs Chef — Rollout Plan

## Phase 0 — Frontend Migration & UI
- [x] Migrate from vanilla JS to Vue 3 + Vite
- [x] Tailwind CSS v3 with custom amber/parchment theme
- [x] Book sidebar (Slack-style left nav)
- [x] Ingredient panel (fixed right, bottom sheet on mobile)
- [x] Single-timer model (tap a step to start)
- [x] Servings scaler inline in ingredients header
- [x] Shopping guide modal
- [x] Recipe hero — full-height, food photo, dark gradient
- [x] Dark theme for recipe steps page
- [x] Sticky transparent header on recipe (fades in on scroll)
- [x] Recipe title fix (updates when navigating between recipes)
- [x] Mobile horizontal scroll fix on hero banner
- [x] Vercel deployment (buildCommand: `cd web && npm install && npm run build`)
- [x] Migrate all frontend JS → TypeScript (shared `types/index.ts`)
- [x] Delete legacy vanilla JS frontend and old CLI scraper

---

## Phase 1 — Google OAuth App
- [x] Create project in Google Cloud Console
- [x] Enable Google OAuth 2.0 credentials (Web application)
- [x] Add authorised redirect URI: `https://vcsuynfbykvncenmhjfh.supabase.co/auth/v1/callback`
- [x] Save Client ID and Client Secret to `.env`

## Phase 2 — Supabase Auth Config
- [x] Enable Google provider in `supabase/config.toml`
- [x] Set `site_url` to Vercel domain, `additional_redirect_urls` for local dev
- [x] Enable Google provider in Supabase dashboard (client_id + secret)

## Phase 3 — Database Migration
- [x] Create `recipe_books` table (`id`, `name`, `owner_id`, `created_at`)
- [x] Create `recipe_book_members` table (`book_id`, `user_id`, `role`)
- [x] Create `recipe_invites` table (`book_id`, `token`, `email`, `expires_at`, `accepted_at`)
- [x] Add `book_id` and `user_id` columns to `recipes`
- [x] Write RLS policies (owner full access, members read, invite accept)
- [x] Run migration on production Supabase project (`supabase db push`)

## Phase 4 — Edge Function Updates
- [x] Create `_shared/auth.ts` — JWT verification helper
- [x] Update `recipes/` — scope to user's books + own recipes
- [x] Update `recipe/` — require JWT
- [x] Update `scrape/` — require JWT, accept `book_id`, set `user_id` on insert
- [x] Create `book/` — list and create recipe books
- [x] Create `invite/` — create invite link, fetch info, accept token
- [x] Deploy all functions (`supabase functions deploy`)

## Phase 5 — Frontend Auth
- [x] Create `useAuth.ts` composable (Supabase JS client, Google sign-in, session state)
- [x] Wire up `LoginView.vue` with real Google OAuth button + invite context
- [x] Auth guard in `router.ts` — redirect unauthenticated users to `/login`
- [x] Replace localStorage secret with JWT in `api.ts`
- [x] Book API calls in `api.ts` (`fetchBooks`, `createBook`, `createInvite`, `acceptInvite`)
- [x] `BookSidebar.vue` — live books, create book inline, user avatar + sign-out
- [x] `App.vue` — init auth on mount, load books, handle pending invite token after OAuth redirect
- [x] `/join?token=` route — shows book name, signs in, accepts invite automatically

---

## Next / Future
- [ ] Invite modal UI in the app (generate + copy link from within a book)
- [ ] `imageUrl` field scraped and stored — recipe hero shows real food photos
- [ ] Recipe edit / re-scrape UI
- [ ] Push notifications for shared book activity

