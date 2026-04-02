create table if not exists public.recipes (
  id         bigint generated always as identity primary key,
  url_hash   text        not null unique,
  source_url text        not null,
  title      text        not null,
  data       jsonb       not null,
  saved_at   timestamptz not null default now()
);
