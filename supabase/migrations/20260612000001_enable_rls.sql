-- Enable RLS on all tables.
-- All access goes through Edge Functions using the service_role key,
-- which bypasses RLS. No anon/user policies needed.

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Deny all direct public access (service_role bypasses these)
create policy "No public access" on public.recipes
  for all using (false);

create policy "No public access" on public.ingredients
  for all using (false);

create policy "No public access" on public.recipe_ingredients
  for all using (false);
