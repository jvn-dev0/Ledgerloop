create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  email text not null check (char_length(trim(email)) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  company_name text check (company_name is null or char_length(company_name) <= 160),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  invoice_number text not null check (char_length(trim(invoice_number)) between 1 and 64),
  description text not null check (char_length(trim(description)) between 1 and 2000),
  amount numeric(20, 6) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issue_date date not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('draft', 'pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_due_after_issue check (due_date >= issue_date),
  constraint invoices_number_per_business unique (business_id, invoice_number),
  constraint invoices_id_business_unique unique (id, business_id),
  constraint invoices_customer_same_business foreign key (customer_id, business_id)
    references public.customers(id, business_id) on delete restrict
);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null,
  provider text not null check (provider in ('paypal')),
  provider_order_id text unique,
  provider_capture_id text unique,
  amount numeric(20, 6) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('created', 'pending_approval', 'approved', 'captured', 'failed', 'cancelled')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  constraint payment_attempt_invoice_same_business foreign key (invoice_id, business_id)
    references public.invoices(id, business_id) on delete restrict
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_id uuid,
  action text not null check (char_length(trim(action)) between 1 and 120),
  entity_type text not null check (char_length(trim(entity_type)) between 1 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index customers_business_name_idx on public.customers (business_id, name);
create index customers_business_email_idx on public.customers (business_id, email);
create index invoices_business_status_due_idx on public.invoices (business_id, status, due_date);
create index invoices_business_created_idx on public.invoices (business_id, created_at desc);
create index invoices_customer_idx on public.invoices (customer_id);
create index payment_attempts_invoice_created_idx on public.payment_attempts (invoice_id, created_at desc);
create index payment_attempts_business_created_idx on public.payment_attempts (business_id, created_at desc);
create index audit_logs_business_created_idx on public.audit_logs (business_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();
create trigger payment_attempts_set_updated_at before update on public.payment_attempts
for each row execute function public.set_updated_at();

create function public.require_verified_payment_for_paid_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    if not exists (
      select 1 from public.payment_attempts p
      where p.invoice_id = new.id
        and p.business_id = new.business_id
        and p.status = 'captured'
        and p.amount = new.amount
        and p.currency = new.currency
    ) then
      raise exception 'An invoice can only be marked paid after a matching captured payment is verified';
    end if;
  end if;
  return new;
end;
$$;

create trigger invoices_require_verified_payment
before insert or update of status on public.invoices
for each row execute function public.require_verified_payment_for_paid_invoice();

create function public.prevent_paid_invoice_edits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'paid' and (
    new.business_id is distinct from old.business_id or
    new.customer_id is distinct from old.customer_id or
    new.invoice_number is distinct from old.invoice_number or
    new.description is distinct from old.description or
    new.amount is distinct from old.amount or
    new.currency is distinct from old.currency or
    new.issue_date is distinct from old.issue_date or
    new.due_date is distinct from old.due_date or
    new.status is distinct from old.status or
    new.created_at is distinct from old.created_at or
    new.updated_at is distinct from old.updated_at
  ) then
    raise exception 'Paid invoices are immutable';
  end if;
  return new;
end;
$$;

create trigger invoices_prevent_paid_edits
before update on public.invoices
for each row execute function public.prevent_paid_invoice_edits();

create function public.owns_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses
    where id = target_business_id and owner_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_business(uuid) from public, anon;
grant execute on function public.owns_business(uuid) to authenticated;

create function public.create_business_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'business_name'), '');
  if requested_name is null then
    requested_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'LedgerLoop') || '''s business';
  end if;

  insert into public.businesses (owner_id, name)
  values (new.id, left(requested_name, 120))
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

create trigger auth_user_create_business
after insert on auth.users
for each row execute function public.create_business_for_new_user();

alter table public.businesses enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.audit_logs enable row level security;

create policy "Owners can view their business" on public.businesses
for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can update their business" on public.businesses
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Business owners manage customers" on public.customers
for all to authenticated
using (public.owns_business(business_id))
with check (public.owns_business(business_id));

create policy "Business owners manage invoices" on public.invoices
for all to authenticated
using (public.owns_business(business_id))
with check (public.owns_business(business_id));

create policy "Business owners view payment attempts" on public.payment_attempts
for select to authenticated
using (public.owns_business(business_id));

create policy "Business owners view audit logs" on public.audit_logs
for select to authenticated
using (public.owns_business(business_id));

grant select, update on public.businesses to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select on public.payment_attempts to authenticated;
grant select on public.audit_logs to authenticated;

create function public.get_dashboard_summary()
returns table (
  currency text,
  total_invoiced text,
  total_paid text,
  total_outstanding text,
  total_overdue text,
  invoice_count bigint,
  overdue_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    i.currency,
    coalesce(sum(i.amount) filter (where i.status in ('pending', 'paid')), 0)::text as total_invoiced,
    coalesce(sum(i.amount) filter (where i.status = 'paid'), 0)::text as total_paid,
    coalesce(sum(i.amount) filter (where i.status = 'pending'), 0)::text as total_outstanding,
    coalesce(sum(i.amount) filter (where i.status = 'pending' and i.due_date < current_date), 0)::text as total_overdue,
    count(*) filter (where i.status in ('pending', 'paid')) as invoice_count,
    count(*) filter (where i.status = 'pending' and i.due_date < current_date) as overdue_count
  from public.invoices i
  where public.owns_business(i.business_id)
  group by i.currency;
$$;

revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
