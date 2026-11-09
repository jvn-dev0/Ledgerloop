-- Day 2 PayPal support. Public checkout links are high-entropy tokens stored
-- only as SHA-256 hashes. All token and payment writes use the server role.

create table public.invoice_payment_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint invoice_payment_link_invoice_unique unique (invoice_id),
  constraint invoice_payment_link_same_business foreign key (invoice_id, business_id)
    references public.invoices(id, business_id) on delete cascade
);

create index invoice_payment_links_active_token_idx
  on public.invoice_payment_links (token_hash) where revoked_at is null;

alter table public.invoice_payment_links enable row level security;
revoke all on public.invoice_payment_links from public, anon, authenticated;
grant all on public.invoice_payment_links to service_role;

create table public.paypal_webhook_events (
  event_id text primary key check (char_length(event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 120),
  resource_id text,
  status text not null check (status in ('processing', 'processed', 'ignored', 'failed')),
  result_detail text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index paypal_webhook_events_received_idx
  on public.paypal_webhook_events (received_at desc);

-- Trigram indexes keep contains-search practical as customer and invoice
-- volumes grow. Supabase keeps most extensions in the extensions schema.
create extension if not exists pg_trgm with schema extensions;
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_email_trgm_idx on public.customers using gin (email extensions.gin_trgm_ops);
create index customers_company_trgm_idx on public.customers using gin (company_name extensions.gin_trgm_ops);
create index invoices_number_trgm_idx on public.invoices using gin (invoice_number extensions.gin_trgm_ops);

alter table public.paypal_webhook_events enable row level security;
revoke all on public.paypal_webhook_events from public, anon, authenticated;
grant all on public.paypal_webhook_events to service_role;

-- Only one active PayPal order may exist for an invoice at a time.
create unique index payment_attempts_one_active_per_invoice_idx
  on public.payment_attempts (business_id, invoice_id)
  where status in ('created', 'pending_approval', 'approved');

create function public.prevent_invoice_edits_with_active_paypal_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.payment_attempts p
    where p.invoice_id = old.id
      and p.business_id = old.business_id
      and p.status in ('created', 'pending_approval', 'approved')
  ) and (
    new.business_id is distinct from old.business_id or
    new.customer_id is distinct from old.customer_id or
    new.invoice_number is distinct from old.invoice_number or
    new.description is distinct from old.description or
    new.amount is distinct from old.amount or
    new.currency is distinct from old.currency or
    new.issue_date is distinct from old.issue_date or
    new.due_date is distinct from old.due_date or
    new.status is distinct from old.status
  ) then
    raise exception using errcode = '55000', message = 'Invoice cannot be edited while PayPal checkout is active';
  end if;
  return new;
end;
$$;

create trigger invoices_prevent_paypal_active_order_edits
before update on public.invoices
for each row execute function public.prevent_invoice_edits_with_active_paypal_order();

-- Captures become final atomically: the payment attempt is marked captured
-- before the invoice trigger allows the invoice to become paid.
create or replace function public.finalize_paypal_payment(
  p_attempt_id uuid,
  p_order_id text,
  p_capture_id text,
  p_amount numeric,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_invoice public.invoices%rowtype;
begin
  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id and provider = 'paypal'
  for update;

  if not found then
    raise exception 'Payment attempt not found';
  end if;
  if v_attempt.provider_order_id is distinct from p_order_id then
    raise exception 'PayPal order does not match the payment attempt';
  end if;
  if v_attempt.status = 'captured' then
    if v_attempt.provider_capture_id is distinct from p_capture_id then
      raise exception 'Payment attempt was captured with a different capture';
    end if;
    return false;
  end if;
  if v_attempt.status not in ('created', 'pending_approval', 'approved') then
    raise exception 'Payment attempt is not eligible for capture';
  end if;

  select * into v_invoice
  from public.invoices
  where id = v_attempt.invoice_id and business_id = v_attempt.business_id
  for update;

  if not found or v_invoice.status <> 'pending' then
    raise exception 'Invoice is not eligible for payment';
  end if;
  if p_amount is distinct from v_attempt.amount
    or p_amount is distinct from v_invoice.amount
    or p_currency is distinct from v_attempt.currency
    or p_currency is distinct from v_invoice.currency then
    raise exception 'Captured amount or currency does not match the invoice';
  end if;
  if p_capture_id is null or char_length(trim(p_capture_id)) = 0 then
    raise exception 'PayPal capture reference is required';
  end if;

  update public.payment_attempts
  set status = 'captured', provider_capture_id = p_capture_id
  where id = v_attempt.id;

  update public.invoices
  set status = 'paid'
  where id = v_invoice.id and business_id = v_invoice.business_id and status = 'pending';

  if not found then
    raise exception 'Invoice state changed before payment finalization';
  end if;
  return true;
end;
$$;

revoke all on function public.finalize_paypal_payment(uuid, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.finalize_paypal_payment(uuid, text, text, numeric, text) to service_role;

-- Dashboard aggregation uses the business-leading invoice index and relies on
-- RLS as the authorization boundary. A caller cannot read another business.
create function public.get_dashboard_summary_for_business(p_business_id uuid)
returns table (
  currency text,
  total_invoiced text,
  total_paid text,
  total_outstanding text,
  total_overdue text,
  invoice_count bigint,
  overdue_count bigint,
  draft_count bigint,
  pending_count bigint,
  paid_count bigint,
  cancelled_count bigint
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
    count(*) filter (where i.status = 'pending' and i.due_date < current_date) as overdue_count,
    count(*) filter (where i.status = 'draft') as draft_count,
    count(*) filter (where i.status = 'pending') as pending_count,
    count(*) filter (where i.status = 'paid') as paid_count,
    count(*) filter (where i.status = 'cancelled') as cancelled_count
  from public.invoices i
  where i.business_id = p_business_id
  group by i.currency;
$$;

revoke all on function public.get_dashboard_summary_for_business(uuid) from public, anon;
grant execute on function public.get_dashboard_summary_for_business(uuid) to authenticated;
