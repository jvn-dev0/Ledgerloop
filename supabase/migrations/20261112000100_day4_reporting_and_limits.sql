do $$
begin
  if to_regclass('public.businesses') is null
    or to_regclass('public.customers') is null
    or to_regclass('public.invoices') is null
    or to_regclass('public.payment_attempts') is null
    or to_regclass('public.agent_activity') is null then
    raise exception 'Apply the Day 1, Day 2, and Day 3 migrations before Day 4.';
  end if;
  if to_regprocedure('public.owns_business(uuid)') is null then
    raise exception 'The Day 1 business ownership function is required before Day 4.';
  end if;
end;
$$;

create index if not exists invoices_business_customer_created_idx
  on public.invoices (business_id, customer_id, created_at desc);

create or replace function public.get_customer_financial_summary_for_business(
  p_business_id uuid,
  p_customer_id uuid
)
returns table (
  currency text,
  total_outstanding text,
  total_overdue text,
  open_invoice_count bigint,
  overdue_invoice_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    invoice.currency,
    coalesce(sum(invoice.amount) filter (where invoice.status = 'pending'), 0)::text,
    coalesce(sum(invoice.amount) filter (where invoice.status = 'pending' and invoice.due_date < current_date), 0)::text,
    count(*) filter (where invoice.status = 'pending'),
    count(*) filter (where invoice.status = 'pending' and invoice.due_date < current_date)
  from public.invoices as invoice
  where invoice.business_id = p_business_id
    and invoice.customer_id = p_customer_id
    and invoice.status in ('pending', 'paid')
    and public.owns_business(p_business_id)
  group by invoice.currency
  order by invoice.currency;
$$;

revoke all on function public.get_customer_financial_summary_for_business(uuid, uuid) from public, anon;
grant execute on function public.get_customer_financial_summary_for_business(uuid, uuid) to authenticated;

create or replace function public.get_customer_payment_attempts_for_business(
  p_business_id uuid,
  p_customer_id uuid,
  p_limit integer default 10
)
returns table (
  id uuid,
  invoice_id uuid,
  invoice_number text,
  amount text,
  currency text,
  status text,
  provider_order_id text,
  provider_capture_id text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    attempt.id,
    attempt.invoice_id,
    invoice.invoice_number,
    attempt.amount::text,
    attempt.currency,
    attempt.status,
    attempt.provider_order_id,
    attempt.provider_capture_id,
    attempt.created_at
  from public.payment_attempts as attempt
  join public.invoices as invoice
    on invoice.id = attempt.invoice_id
    and invoice.business_id = attempt.business_id
  where attempt.business_id = p_business_id
    and invoice.customer_id = p_customer_id
    and public.owns_business(p_business_id)
  order by attempt.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

revoke all on function public.get_customer_payment_attempts_for_business(uuid, uuid, integer) from public, anon;
grant execute on function public.get_customer_payment_attempts_for_business(uuid, uuid, integer) to authenticated;

create or replace function public.get_customer_collection_activity_for_business(
  p_business_id uuid,
  p_customer_id uuid,
  p_limit integer default 10
)
returns table (
  activity_id uuid,
  invoice_id uuid,
  invoice_number text,
  tool_name text,
  status text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    activity.id,
    invoice.id,
    invoice.invoice_number,
    activity.tool_name,
    activity.status,
    activity.created_at
  from public.agent_activity as activity
  join public.invoices as invoice
    on invoice.id = activity.entity_id
    and invoice.business_id = activity.business_id
  where activity.business_id = p_business_id
    and activity.entity_type = 'invoice'
    and invoice.customer_id = p_customer_id
    and public.owns_business(p_business_id)
  order by activity.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

revoke all on function public.get_customer_collection_activity_for_business(uuid, uuid, integer) from public, anon;
grant execute on function public.get_customer_collection_activity_for_business(uuid, uuid, integer) to authenticated;

create table if not exists public.api_rate_limit_buckets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('agent_chat', 'knowledge_upload')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  primary key (owner_id, scope)
);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(p_scope text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_request_count integer;
  v_window_started_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_scope = 'agent_chat' then
    v_limit := 8;
  elsif p_scope = 'knowledge_upload' then
    v_limit := 3;
  else
    raise exception using errcode = '22023', message = 'Unsupported rate limit scope';
  end if;

  insert into public.api_rate_limit_buckets (owner_id, scope, window_started_at, request_count)
  values ((select auth.uid()), p_scope, clock_timestamp(), 1)
  on conflict (owner_id, scope) do update
    set request_count = case
          when public.api_rate_limit_buckets.window_started_at <= clock_timestamp() - interval '60 seconds' then 1
          else least(public.api_rate_limit_buckets.request_count + 1, v_limit + 1)
        end,
        window_started_at = case
          when public.api_rate_limit_buckets.window_started_at <= clock_timestamp() - interval '60 seconds' then clock_timestamp()
          else public.api_rate_limit_buckets.window_started_at
        end
  returning request_count, window_started_at into v_request_count, v_window_started_at;

  return query
    select
      v_request_count <= v_limit,
      greatest(1, ceil(extract(epoch from (v_window_started_at + interval '60 seconds' - clock_timestamp())))::integer);
end;
$$;

revoke all on function public.consume_api_rate_limit(text) from public, anon;
grant execute on function public.consume_api_rate_limit(text) to authenticated;
