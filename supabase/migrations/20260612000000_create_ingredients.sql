-- ── ingredients ──────────────────────────────────────────────────────────────
-- Canonical ingredient dictionary. Names are Claude-style lowercase.
-- USDA is used as a data source for conversions and deduplication only.
create table if not exists public.ingredients (
  id           bigint generated always as identity primary key,
  name         text        not null unique,          -- canonical, e.g. "balsamic vinegar"
  aliases      text[]      not null default '{}',    -- e.g. ["scallion", "spring onion"]
  usda_fdc_id  integer     unique,                   -- USDA FoodData Central ID (null if not found)
  category     text,                                 -- e.g. "vegetable", "dairy", "spice"
  conversions  jsonb       not null default '{}',    -- e.g. {"each_g": 110, "tbsp_g": 16}
  created_at   timestamptz not null default now()
);

-- Fast alias lookups (array containment)
create index if not exists ingredients_aliases_gin
  on public.ingredients using gin (aliases);

-- Fast category filtering
create index if not exists ingredients_category_idx
  on public.ingredients (category);

-- ── recipe_ingredients ────────────────────────────────────────────────────────
-- Junction table linking recipes to canonical ingredients.
-- ingredient_id is nullable — unmatched items retry on future scrapes.
create table if not exists public.recipe_ingredients (
  id             bigint generated always as identity primary key,
  recipe_id      bigint      not null references public.recipes(id) on delete cascade,
  ingredient_id  bigint      references public.ingredients(id),     -- null = unmatched
  raw_name       text        not null,   -- original Claude name, kept for retry/audit
  quantity       text,
  unit           text,
  notes          text,
  group_name     text,                   -- ingredient group label, e.g. "For the sauce"
  position       integer     not null,   -- order within recipe
  match_score    real        not null default 0, -- 1.0 exact, 0.9 alias, 0–0.89 USDA fuzzy, 0 unmatched
  created_at     timestamptz not null default now(),
  unique (recipe_id, position)
);

create index if not exists recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients (recipe_id);

create index if not exists recipe_ingredients_ingredient_id_idx
  on public.recipe_ingredients (ingredient_id);

-- Unmatched rows — used to find retry candidates
create index if not exists recipe_ingredients_unmatched_idx
  on public.recipe_ingredients (recipe_id)
  where ingredient_id is null;
