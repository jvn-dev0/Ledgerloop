-- Day 3 additive schema for the LedgerLoop collections assistant.
-- Apply the Day 1 and Day 2 migrations first. This migration deliberately
-- fails before changing anything when their core objects are absent.

do $$
declare
  missing_objects text[] := array[]::text[];
begin
  if to_regclass('public.businesses') is null then missing_objects := array_append(missing_objects, 'public.businesses'); end if;
  if to_regclass('public.customers') is null then missing_objects := array_append(missing_objects, 'public.customers'); end if;
  if to_regclass('public.invoices') is null then missing_objects := array_append(missing_objects, 'public.invoices'); end if;
  if to_regclass('public.payment_attempts') is null then missing_objects := array_append(missing_objects, 'public.payment_attempts'); end if;
  if to_regclass('public.audit_logs') is null then missing_objects := array_append(missing_objects, 'public.audit_logs'); end if;
  if cardinality(missing_objects) > 0 then
    raise exception 'Apply the Day 1 and Day 2 migrations before Day 3. Missing: %', array_to_string(missing_objects, ', ');
  end if;
  if not exists (select 1 from pg_extension where extname = 'vector') then
    raise exception 'The pgvector extension must be enabled before applying the Day 3 migration.';
  end if;
end;
$$;

alter table public.customers
  add column collection_contact_preference text
  check (collection_contact_preference is null or collection_contact_preference in ('email', 'phone', 'portal'));

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 180),
  mime_type text not null check (mime_type in ('text/plain', 'text/markdown', 'application/pdf')),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  chunk_count integer not null default 0 check (chunk_count between 0 and 300),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create index knowledge_documents_business_updated_idx
  on public.knowledge_documents (business_id, updated_at desc);
create index knowledge_documents_business_hash_idx
  on public.knowledge_documents (business_id, content_sha256);

create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null default 'Collections review' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create index agent_conversations_business_updated_idx
  on public.agent_conversations (business_id, updated_at desc);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12_000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_messages_conversation_same_business foreign key (conversation_id, business_id)
    references public.agent_conversations(id, business_id) on delete cascade
);

create index agent_messages_conversation_created_idx
  on public.agent_messages (business_id, conversation_id, created_at desc);

create table public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  conversation_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  tool_call_id text not null check (char_length(tool_call_id) between 1 and 128),
  tool_name text not null check (tool_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  status text not null check (status in ('started', 'completed', 'failed')),
  entity_type text check (entity_type is null or char_length(entity_type) <= 80),
  entity_id uuid,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_activity_conversation_same_business foreign key (conversation_id, business_id)
    references public.agent_conversations(id, business_id) on delete cascade,
  unique (conversation_id, tool_call_id)
);

create index agent_activity_business_created_idx
  on public.agent_activity (business_id, created_at desc);
create index agent_activity_invoice_tool_idx
  on public.agent_activity (business_id, entity_id, tool_name, status, created_at desc)
  where entity_type = 'invoice';

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  conversation_id uuid not null,
  invoice_id uuid not null,
  action_type text not null check (action_type in ('create_payment_link')),
  status text not null default 'pending' check (status in ('pending', 'executing', 'approved', 'rejected', 'executed', 'failed', 'expired')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  constraint approval_conversation_same_business foreign key (conversation_id, business_id)
    references public.agent_conversations(id, business_id) on delete cascade,
  constraint approval_invoice_same_business foreign key (invoice_id, business_id)
    references public.invoices(id, business_id) on delete restrict
);

create index approval_requests_business_status_created_idx
  on public.approval_requests (business_id, status, created_at desc);
create unique index approval_requests_one_active_per_invoice_idx
  on public.approval_requests (business_id, invoice_id)
  where status in ('pending', 'executing');

do $$
declare
  vector_schema text;
begin
  select namespace.nspname into vector_schema
  from pg_extension extension
  join pg_namespace namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'vector';
  if vector_schema is null then
    raise exception 'Could not find the schema containing pgvector.';
  end if;

  execute format($ddl$
    create table public.knowledge_chunks (
      id uuid primary key default gen_random_uuid(),
      business_id uuid not null,
      document_id uuid not null,
      chunk_index integer not null check (chunk_index between 0 and 299),
      content text not null check (char_length(content) between 1 and 4000),
      embedding %I.vector(384) not null,
      created_at timestamptz not null default now(),
      constraint knowledge_chunk_document_same_business foreign key (document_id, business_id)
        references public.knowledge_documents(id, business_id) on delete cascade,
      unique (document_id, chunk_index)
    )
  $ddl$, vector_schema);

  execute format('create index knowledge_chunks_embedding_hnsw_idx on public.knowledge_chunks using hnsw (embedding %I.vector_cosine_ops)', vector_schema);
  execute 'create index knowledge_chunks_business_document_idx on public.knowledge_chunks (business_id, document_id, chunk_index)';

  execute format($fn$
    create function public.match_knowledge_chunks(
      p_business_id uuid,
      p_embedding %I.vector(384),
      p_match_count integer default 5,
      p_similarity_threshold real default 0.25
    )
    returns table (
      chunk_id uuid,
      document_id uuid,
      document_name text,
      chunk_index integer,
      content text,
      similarity real
    )
    language sql
    stable
    security definer
    set search_path = ''
    as $body$
      select
        chunk.id,
        document.id,
        document.name,
        chunk.chunk_index,
        chunk.content,
        (1 - (chunk.embedding operator(%I.<=>) p_embedding))::real as similarity
      from public.knowledge_chunks as chunk
      join public.knowledge_documents as document
        on document.id = chunk.document_id and document.business_id = chunk.business_id
      where chunk.business_id = p_business_id
        and public.owns_business(p_business_id)
        and (1 - (chunk.embedding operator(%I.<=>) p_embedding)) >= p_similarity_threshold
      order by chunk.embedding operator(%I.<=>) p_embedding
      limit least(greatest(coalesce(p_match_count, 5), 1), 8)
    $body$
  $fn$, vector_schema, vector_schema, vector_schema, vector_schema);
end;
$$;

create function public.save_knowledge_document(
  p_document_id uuid,
  p_business_id uuid,
  p_name text,
  p_mime_type text,
  p_content_sha256 text,
  p_chunks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_document_id uuid := coalesce(p_document_id, gen_random_uuid());
  chunk_record jsonb;
  chunk_index integer := 0;
begin
  if auth.uid() is null or not public.owns_business(p_business_id) then
    raise exception using errcode = '42501', message = 'Not authorised for this business.';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 180
    or p_mime_type is null or p_mime_type not in ('text/plain', 'text/markdown', 'application/pdf')
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_chunks is null or jsonb_typeof(p_chunks) <> 'array' then
    raise exception using errcode = '22023', message = 'Knowledge document input is invalid.';
  end if;
  if jsonb_array_length(p_chunks) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'Knowledge document chunk count is invalid.';
  end if;

  if p_document_id is null then
    insert into public.knowledge_documents (id, business_id, name, mime_type, content_sha256, chunk_count, created_by)
    values (saved_document_id, p_business_id, p_name, p_mime_type, p_content_sha256, jsonb_array_length(p_chunks), auth.uid());
  else
    update public.knowledge_documents
      set name = p_name, mime_type = p_mime_type, content_sha256 = p_content_sha256,
          chunk_count = jsonb_array_length(p_chunks), updated_at = now()
      where id = p_document_id and business_id = p_business_id;
    if not found then raise exception using errcode = 'P0002', message = 'Knowledge document was not found.'; end if;
    delete from public.knowledge_chunks where document_id = p_document_id and business_id = p_business_id;
  end if;

  for chunk_record in select value from jsonb_array_elements(p_chunks) loop
    if jsonb_typeof(chunk_record->'content') <> 'string'
      or char_length(chunk_record->>'content') not between 1 and 4000
      or jsonb_typeof(chunk_record->'embedding') <> 'string'
      or chunk_record->>'embedding' !~ '^\[[-0-9.eE, ]+\]$' then
      raise exception using errcode = '22023', message = 'Knowledge chunk input is invalid.';
    end if;
    execute format(
      'insert into public.knowledge_chunks (business_id, document_id, chunk_index, content, embedding) values ($1, $2, $3, $4, $5::%I.vector(384))',
      (select namespace.nspname from pg_extension extension join pg_namespace namespace on namespace.oid = extension.extnamespace where extension.extname = 'vector')
    ) using p_business_id, saved_document_id, chunk_index, chunk_record->>'content', chunk_record->>'embedding';
    chunk_index := chunk_index + 1;
  end loop;
  return saved_document_id;
end;
$$;

create function public.get_customer_payment_history(
  p_business_id uuid,
  p_customer_ids uuid[],
  p_exclude_invoice_ids uuid[] default array[]::uuid[]
)
returns table (customer_id uuid, previous_invoice_count bigint, previous_paid_invoice_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    invoice.customer_id,
    count(*)::bigint,
    count(*) filter (where invoice.status = 'paid')::bigint
  from public.invoices as invoice
  where invoice.business_id = p_business_id
    and invoice.customer_id = any(p_customer_ids)
    and invoice.id <> all(coalesce(p_exclude_invoice_ids, array[]::uuid[]))
    and invoice.status in ('pending', 'paid')
    and public.owns_business(p_business_id)
  group by invoice.customer_id;
$$;

create function public.get_invoice_reminder_counts(
  p_business_id uuid,
  p_invoice_ids uuid[]
)
returns table (invoice_id uuid, reminder_draft_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select activity.entity_id, count(*)::bigint
  from public.agent_activity as activity
  where activity.business_id = p_business_id
    and activity.entity_type = 'invoice'
    and activity.entity_id = any(p_invoice_ids)
    and activity.tool_name = 'draft_payment_reminder'
    and activity.status = 'completed'
    and public.owns_business(p_business_id)
  group by activity.entity_id;
$$;

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_activity enable row level security;
alter table public.approval_requests enable row level security;

create policy "Owners manage business knowledge documents" on public.knowledge_documents
for all to authenticated using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners manage business knowledge chunks" on public.knowledge_chunks
for all to authenticated using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners manage business agent conversations" on public.agent_conversations
for all to authenticated using (public.owns_business(business_id)) with check (public.owns_business(business_id) and created_by = (select auth.uid()));
create policy "Owners manage business agent messages" on public.agent_messages
for all to authenticated using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Owners view business agent activity" on public.agent_activity
for select to authenticated using (public.owns_business(business_id));
create policy "Owners view business approval requests" on public.approval_requests
for select to authenticated using (public.owns_business(business_id));
create policy "Owners request business approvals" on public.approval_requests
for insert to authenticated with check (
  public.owns_business(business_id)
  and requested_by = (select auth.uid())
  and action_type = 'create_payment_link'
  and status = 'pending'
  and decided_by is null
  and decided_at is null
  and result = '{}'::jsonb
);

grant select, insert, update, delete on public.knowledge_documents to authenticated;
grant select, insert, update, delete on public.agent_conversations to authenticated;
grant select, insert on public.agent_messages to authenticated;
grant select on public.agent_activity to authenticated;
grant select, insert on public.approval_requests to authenticated;

create function public.record_agent_activity(
  p_business_id uuid,
  p_conversation_id uuid,
  p_tool_call_id text,
  p_tool_name text,
  p_status text,
  p_entity_type text,
  p_entity_id uuid,
  p_input_summary jsonb,
  p_output_summary jsonb,
  p_duration_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_id uuid;
begin
  if auth.uid() is null or not public.owns_business(p_business_id) then
    raise exception using errcode = '42501', message = 'Not authorised for this business.';
  end if;
  if not exists (
    select 1 from public.agent_conversations conversation
    where conversation.id = p_conversation_id and conversation.business_id = p_business_id
  ) then
    raise exception using errcode = 'P0002', message = 'Conversation was not found.';
  end if;
  if p_tool_name not in (
    'get_business_summary', 'list_invoices', 'get_overdue_invoices', 'get_customer_history',
    'calculate_receivables', 'retrieve_business_policy', 'prioritize_collections',
    'draft_payment_reminder', 'create_approval_request', 'get_paypal_payment_status'
  ) or p_status not in ('started', 'completed', 'failed') then
    raise exception using errcode = '22023', message = 'Agent activity input is invalid.';
  end if;
  if octet_length(coalesce(p_input_summary, '{}'::jsonb)::text) > 2000
    or octet_length(coalesce(p_output_summary, '{}'::jsonb)::text) > 6000
    or p_duration_ms < 0 then
    raise exception using errcode = '22023', message = 'Agent activity summary is too large.';
  end if;
  insert into public.agent_activity (
    business_id, conversation_id, actor_id, tool_call_id, tool_name, status,
    entity_type, entity_id, input_summary, output_summary, duration_ms
  ) values (
    p_business_id, p_conversation_id, auth.uid(), p_tool_call_id, p_tool_name,
    p_status, p_entity_type, p_entity_id, coalesce(p_input_summary, '{}'::jsonb),
    coalesce(p_output_summary, '{}'::jsonb), p_duration_ms
  )
  on conflict (conversation_id, tool_call_id) do update set
    status = excluded.status,
    entity_type = coalesce(excluded.entity_type, public.agent_activity.entity_type),
    entity_id = coalesce(excluded.entity_id, public.agent_activity.entity_id),
    input_summary = excluded.input_summary,
    output_summary = excluded.output_summary,
    duration_ms = excluded.duration_ms,
    updated_at = now()
  where public.agent_activity.business_id = p_business_id
    and public.agent_activity.actor_id = auth.uid()
    and public.agent_activity.status = 'started'
    and p_status in ('completed', 'failed')
  returning id into activity_id;
  if not found then
    raise exception using errcode = '23505', message = 'Agent activity could not be recorded.';
  end if;
  return activity_id;
end;
$$;

revoke all on function public.record_agent_activity(uuid, uuid, text, text, text, text, uuid, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.record_agent_activity(uuid, uuid, text, text, text, text, uuid, jsonb, jsonb, integer) to authenticated;
revoke all on function public.save_knowledge_document(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_customer_payment_history(uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.get_invoice_reminder_counts(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.save_knowledge_document(uuid, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.get_customer_payment_history(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.get_invoice_reminder_counts(uuid, uuid[]) to authenticated;

do $$
declare
  vector_schema text;
begin
  select namespace.nspname into vector_schema
  from pg_extension extension
  join pg_namespace namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'vector';
  execute format('revoke all on function public.match_knowledge_chunks(uuid, %I.vector, integer, real) from public, anon, authenticated', vector_schema);
  execute format('grant execute on function public.match_knowledge_chunks(uuid, %I.vector, integer, real) to authenticated', vector_schema);
end;
$$;
