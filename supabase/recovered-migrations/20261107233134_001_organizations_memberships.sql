-- Recovered verbatim from supabase_migrations.schema_migrations.
-- Original applied version: 20261107233134
-- Original migration name: 001_organizations_memberships
-- Archival copy only; see README before replaying.

-- KOVO DEV: initial organization and membership security foundation.
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('psychologa', 'recepcion', 'gestoria')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint memberships_org_user_unique unique (org_id, user_id)
);

create index if not exists memberships_user_active_idx
  on public.memberships (user_id, active);
create index if not exists memberships_org_idx
  on public.memberships (org_id);

create or replace function public.my_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id
  from public.memberships as m
  where m.user_id = auth.uid()
    and m.active = true;
$$;

create or replace function public.has_role(target_org uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.active = true
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.my_orgs() from public, anon;
revoke all on function public.has_role(uuid, text[]) from public, anon;
grant execute on function public.my_orgs() to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select to authenticated
  using (id in (select public.my_orgs()));

drop policy if exists memberships_select_org_member on public.memberships;
create policy memberships_select_org_member
  on public.memberships
  for select to authenticated
  using (org_id in (select public.my_orgs()));

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.memberships to authenticated;

comment on table public.organizations is 'KOVO tenant organizations; creation is restricted to trusted server-side workflows.';
comment on table public.memberships is 'User membership and application role per organization; writes are restricted to trusted server-side workflows.';
