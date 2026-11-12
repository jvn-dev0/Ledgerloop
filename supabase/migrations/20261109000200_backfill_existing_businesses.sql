-- Existing-account repair for accounts created before the Day 1 schema was installed.
-- The Day 1 auth.users trigger only handles users created after that schema.
-- Safe to apply more than once: existing business rows are left unchanged.

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'Apply the Day 1 initial schema before the existing-account workspace backfill.';
  end if;
end;
$$;

insert into public.businesses (owner_id, name)
select
  auth_user.id,
  left(
    coalesce(
      nullif(trim(auth_user.raw_user_meta_data ->> 'business_name'), ''),
      nullif(split_part(coalesce(auth_user.email, ''), '@', 1), '') || '''s business',
      'LedgerLoop business'
    ),
    120
  )
from auth.users as auth_user
where not exists (
  select 1
  from public.businesses as existing_business
  where existing_business.owner_id = auth_user.id
)
on conflict (owner_id) do nothing;
