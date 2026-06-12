-- ── Recipe Books ────────────────────────────────────────────────────────────

create table if not exists public.recipe_books (
  id         bigint generated always as identity primary key,
  name       text        not null,
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── Book Members ─────────────────────────────────────────────────────────────
-- role: 'owner' | 'member'

create table if not exists public.recipe_book_members (
  book_id    bigint      not null references public.recipe_books(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (book_id, user_id)
);

-- ── Invites ───────────────────────────────────────────────────────────────────

create table if not exists public.recipe_invites (
  id          bigint      generated always as identity primary key,
  book_id     bigint      not null references public.recipe_books(id) on delete cascade,
  token       text        not null unique default gen_random_uuid()::text,
  created_by  uuid        not null references auth.users(id) on delete cascade,
  email       text,                      -- optional: restrict invite to one email
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── Add book_id / user_id to recipes ─────────────────────────────────────────

alter table public.recipes
  add column if not exists book_id  bigint references public.recipe_books(id) on delete cascade,
  add column if not exists user_id  uuid   references auth.users(id) on delete set null;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.recipe_books        enable row level security;
alter table public.recipe_book_members enable row level security;
alter table public.recipe_invites      enable row level security;

-- recipe_books: members can read; owner can insert/update/delete
create policy "Book members can read"
  on public.recipe_books for select
  using (
    id in (
      select book_id from public.recipe_book_members
      where user_id = auth.uid()
    )
  );

create policy "Owner can manage book"
  on public.recipe_books for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- recipe_book_members: members can read own book's members; owner can insert/delete
create policy "Members can read membership"
  on public.recipe_book_members for select
  using (
    book_id in (
      select book_id from public.recipe_book_members
      where user_id = auth.uid()
    )
  );

create policy "Owner can manage members"
  on public.recipe_book_members for all
  using (
    book_id in (
      select id from public.recipe_books where owner_id = auth.uid()
    )
  );

-- Allow insert when accepting an invite (user adds themselves)
create policy "User can join via invite"
  on public.recipe_book_members for insert
  with check (user_id = auth.uid());

-- recipe_invites: book owner can manage; anyone with token can read (for acceptance)
create policy "Owner can manage invites"
  on public.recipe_invites for all
  using (
    book_id in (
      select id from public.recipe_books where owner_id = auth.uid()
    )
  );

create policy "Anyone can read invite by token"
  on public.recipe_invites for select
  using (true);  -- token is unguessable; acceptance is gated in edge function

-- recipes: members can read; owner/uploader can insert/update/delete
-- Drop the blanket deny policy first, then add scoped ones
drop policy if exists "No public access" on public.recipes;

create policy "Book members can read recipes"
  on public.recipes for select
  using (
    book_id in (
      select book_id from public.recipe_book_members
      where user_id = auth.uid()
    )
  );

create policy "Uploader can manage recipe"
  on public.recipes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
