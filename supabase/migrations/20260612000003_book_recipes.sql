-- ── book_recipes junction table ───────────────────────────────────────────────
-- Decouples recipe data (globally cached by url_hash) from book membership.
-- Each book can independently "own" the same recipe URL without re-scraping.

create table if not exists public.book_recipes (
  book_id    bigint      not null references public.recipe_books(id) on delete cascade,
  recipe_id  bigint      not null references public.recipes(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (book_id, recipe_id)
);

create index if not exists book_recipes_book_id_idx on public.book_recipes (book_id);

-- RLS: all access via service_role through Edge Functions
alter table public.book_recipes enable row level security;
create policy "No public access" on public.book_recipes for all using (false);

-- Migrate existing book_id associations from recipes table
insert into public.book_recipes (book_id, recipe_id)
select book_id, id from public.recipes
where book_id is not null
on conflict do nothing;
