begin;
create table if not exists public.ops_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'viewer' check(role in ('admin','viewer')),
 enabled boolean not null default true
);
create or replace function public.ops_can_read() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.ops_members where user_id=auth.uid() and enabled);
$$;
revoke all on function public.ops_can_read() from public,anon;
grant execute on function public.ops_can_read() to authenticated;
create table if not exists public.ops_sources (
 source_hash text primary key check(source_hash ~ '^[a-f0-9]{64}$'),
 label text not null,bytes bigint not null check(bytes>=0),
 file_modified_at timestamptz not null,freshness text not null
);
create table if not exists public.ops_shops (
 shop_key text primary key,platform text not null check(platform in ('douyin','kuaishou')),
 shop_name text not null,platform_shop_id text,identity_basis text not null,
 unique(platform,platform_shop_id)
);
create table if not exists public.ops_accounts (
 id text primary key,shop_key text not null references public.ops_shops,
 captured_at timestamptz not null,capture_time_basis text not null,
 funds jsonb not null,collection jsonb not null,
 source_hash text not null references public.ops_sources
);
create table if not exists public.ops_inventory (
 id text primary key,shop_key text not null references public.ops_shops,
 captured_at timestamptz not null,summary jsonb not null,
 items jsonb not null check(jsonb_typeof(items)='array'),
 source_hash text not null references public.ops_sources
);
create table if not exists public.ops_business (
 id text primary key,shop_key text not null references public.ops_shops,
 platform text not null check(platform in ('douyin','kuaishou')),
 start_date date not null,end_date date not null,requested_end_date date,
 gross_cents bigint check(gross_cents>=0),refund_payment_cents bigint check(refund_payment_cents>=0),net_cents bigint,
 captured_at timestamptz not null,refund_metric text not null,
 source_hash text not null references public.ops_sources,platform_source_hash text,
 check(end_date>=start_date and end_date-start_date<31),
 check(requested_end_date is null or requested_end_date>=end_date),
 check(net_cents is not distinct from case when platform='douyin' and gross_cents is not null and refund_payment_cents is not null then gross_cents-refund_payment_cents else null end)
);
create table if not exists public.ops_traffic_baseline (
 id text primary key,source_hash text not null references public.ops_sources,
 backed_up_at timestamptz not null,freshness text not null,data jsonb not null
);
create table if not exists public.ops_traffic_rows (
 id text primary key,kind text not null,source_key text not null,ordinal integer not null,
 payload jsonb not null,source_hash text not null references public.ops_sources,
 unique(source_hash,kind,source_key)
);
create table if not exists public.ops_migration_batches (
 batch_id text primary key,payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 applied_at timestamptz not null default now(),counts jsonb not null
);
create index if not exists ops_accounts_latest on public.ops_accounts(shop_key,captured_at desc);
create index if not exists ops_inventory_latest on public.ops_inventory(shop_key,captured_at desc);
create index if not exists ops_business_period on public.ops_business(platform,shop_key,start_date,end_date,captured_at desc);
create index if not exists ops_traffic_kind on public.ops_traffic_rows(source_hash,kind,ordinal);

do $policies$
declare t text;
begin
 foreach t in array array['ops_members','ops_sources','ops_shops','ops_accounts','ops_inventory','ops_business','ops_traffic_baseline','ops_traffic_rows','ops_migration_batches'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='ops_member_read') then
   if t='ops_members' then
    execute format('create policy ops_member_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
   else
    execute format('create policy ops_member_read on public.%I for select to authenticated using(public.ops_can_read())',t);
   end if;
  end if;
 end loop;
end;
$policies$;

create or replace function public.ops_import_bundle(p_batch text,p_hash text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare previous public.ops_migration_batches; counts jsonb;
begin
 if coalesce(p_batch,'')='' or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid migration identity';end if;
 perform pg_advisory_xact_lock(hashtextextended('ops-initial-migration',0));
 select * into previous from public.ops_migration_batches where batch_id=p_batch;
 if found then
  if previous.payload_hash<>p_hash then raise exception 'batch payload conflict';end if;
  return jsonb_build_object('ok',true,'alreadyApplied',true,'batchId',p_batch,'payloadHash',p_hash,'counts',previous.counts);
 end if;
 insert into public.ops_sources select * from jsonb_populate_recordset(null::public.ops_sources,p_payload->'sources') on conflict do nothing;
 insert into public.ops_shops select * from jsonb_populate_recordset(null::public.ops_shops,p_payload->'shops') on conflict do nothing;
 insert into public.ops_accounts select * from jsonb_populate_recordset(null::public.ops_accounts,p_payload->'accounts') on conflict do nothing;
 insert into public.ops_inventory select * from jsonb_populate_recordset(null::public.ops_inventory,p_payload->'inventories') on conflict do nothing;
 insert into public.ops_business select * from jsonb_populate_recordset(null::public.ops_business,p_payload->'business') on conflict do nothing;
 insert into public.ops_traffic_baseline select * from jsonb_populate_recordset(null::public.ops_traffic_baseline,p_payload->'traffic_baseline') on conflict do nothing;
 insert into public.ops_traffic_rows select * from jsonb_populate_recordset(null::public.ops_traffic_rows,p_payload->'traffic_rows') on conflict do nothing;
 counts=jsonb_build_object('shops',jsonb_array_length(p_payload->'shops'),'accounts',jsonb_array_length(p_payload->'accounts'),'inventories',jsonb_array_length(p_payload->'inventories'),'business',jsonb_array_length(p_payload->'business'),'trafficRows',jsonb_array_length(p_payload->'traffic_rows'));
 insert into public.ops_migration_batches(batch_id,payload_hash,counts) values(p_batch,p_hash,counts);
 return jsonb_build_object('ok',true,'alreadyApplied',false,'batchId',p_batch,'payloadHash',p_hash,'counts',counts);
end;
$$;
revoke all on function public.ops_import_bundle(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ops_import_bundle(text,text,jsonb) to service_role;
commit;
