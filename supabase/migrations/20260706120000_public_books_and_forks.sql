-- Book visibility: public books are readable (and forkable) by any signed-in user.
alter table public.recipe_books
  add column if not exists visibility text not null default 'private'
    check (visibility in ('public', 'private'));

-- Fork lineage
alter table public.recipes
  add column if not exists forked_from_recipe_id bigint references public.recipes(id) on delete set null,
  add column if not exists forked_from_book_id bigint references public.recipe_books(id) on delete set null;

create index if not exists recipes_forked_from_idx on public.recipes (forked_from_recipe_id);
