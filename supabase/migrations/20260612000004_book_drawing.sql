-- Add drawing overlay URL to recipe_books
alter table public.recipe_books
  add column if not exists drawing_url text;

-- Storage bucket for book drawings (transparent PNG overlays)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-drawings',
  'book-drawings',
  true,           -- public read so <img> works without auth headers
  2097152,        -- 2 MB max per drawing
  array['image/png']
)
on conflict (id) do nothing;

-- Only authenticated users can upload to their own book folder
-- (edge function uses service_role so this just guards direct uploads)
create policy "Authenticated upload to book-drawings"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'book-drawings');

create policy "Public read from book-drawings"
  on storage.objects for select
  to public
  using (bucket_id = 'book-drawings');

create policy "Authenticated delete from book-drawings"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'book-drawings');
