begin;
create table if not exists public.ops_devices (
 id text primary key,kind text not null check(kind='account'),
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 config jsonb not null,status jsonb not null default '{}',last_seen_at timestamptz
);
create table if not exists public.ops_collector_runs (
 device_id text not null references public.ops_devices(id),run_id text not null,
 status text not null,summary jsonb not null,data_hash text,received_at timestamptz not null default now(),
 primary key(device_id,run_id)
);
create table if not exists public.ops_collector_snapshots (
 device_id text primary key references public.ops_devices(id),data_hash text not null,
 captured_order bigint not null,updated_at timestamptz not null default now()
);
alter table public.ops_devices enable row level security;
alter table public.ops_collector_runs enable row level security;
alter table public.ops_collector_snapshots enable row level security;
revoke all on public.ops_devices,public.ops_collector_runs,public.ops_collector_snapshots from anon,authenticated;
grant all on public.ops_devices,public.ops_collector_runs,public.ops_collector_snapshots to service_role;
create or replace function public.ops_device_heartbeat(p_device text,p_status jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update public.ops_devices set last_seen_at=now(),status=p_status
 where id=p_device and (status is distinct from p_status or last_seen_at is null or last_seen_at<now()-interval '5 minutes');
 return true;
end;
$$;
revoke all on function public.ops_device_heartbeat(text,jsonb) from public,anon,authenticated;
grant execute on function public.ops_device_heartbeat(text,jsonb) to service_role;
create or replace function public.ops_receive_account_run(p_device text,p_run text,p_status text,p_summary jsonb,p_hash text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior public.ops_collector_runs; applied boolean=false; capture_order bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_device,0));
 select * into prior from public.ops_collector_runs where device_id=p_device and run_id=p_run;
 if found and prior.data_hash is distinct from p_hash then raise exception 'run data hash conflict';end if;
 insert into public.ops_collector_runs(device_id,run_id,status,summary,data_hash) values(p_device,p_run,p_status,p_summary,p_hash)
 on conflict(device_id,run_id) do nothing;
 if p_hash is not null then
  capture_order=coalesce((p_summary->>'_capturedAt')::bigint,0);
  if capture_order<=0 then raise exception 'capture ordering missing';end if;
  insert into public.ops_collector_snapshots(device_id,data_hash,captured_order) values(p_device,p_hash,capture_order)
  on conflict(device_id) do update set data_hash=excluded.data_hash,captured_order=excluded.captured_order,updated_at=now()
  where excluded.captured_order>ops_collector_snapshots.captured_order and excluded.data_hash is distinct from ops_collector_snapshots.data_hash;
  select data_hash=p_hash into applied from public.ops_collector_snapshots where device_id=p_device;
 end if;
 return jsonb_build_object('ok',true,'dataHash',p_hash,'snapshotApplied',applied);
end;
$$;
revoke all on function public.ops_receive_account_run(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.ops_receive_account_run(text,text,text,jsonb,text) to service_role;
commit;
