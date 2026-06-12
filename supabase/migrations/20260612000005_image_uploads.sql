-- ── Custom banner image per book ─────────────────────────────────────────────
alter table public.recipe_books
  add column if not exists banner_url text;

-- ── Custom image override per recipe (takes priority over scraped imageUrl) ──
alter table public.recipes
  add column if not exists image_url text;

-- ── Storage: book-banners ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-banners', 'book-banners', true,
  5242880,  -- 5 MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

do $$ begin
  create policy "Public read from book-banners"
    on storage.objects for select to public using (bucket_id = 'book-banners');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated upload to book-banners"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'book-banners');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated delete from book-banners"
    on storage.objects for delete to authenticated
    using (bucket_id = 'book-banners');
exception when duplicate_object then null; end $$;

-- ── Storage: recipe-images ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images', 'recipe-images', true,
  5242880,  -- 5 MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

do $$ begin
  create policy "Public read from recipe-images"
    on storage.objects for select to public using (bucket_id = 'recipe-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated upload to recipe-images"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'recipe-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated delete from recipe-images"
    on storage.objects for delete to authenticated
    using (bucket_id = 'recipe-images');
exception when duplicate_object then null; end $$;
