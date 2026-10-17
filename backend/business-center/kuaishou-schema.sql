create table if not exists public.acct_kuaishou_business_ranges (
 device_id text not null references public.acct_devices(id),
 shop_name text not null,
 start_date date not null,
 end_date date not null,
 gross_cents bigint check(gross_cents >= 0),
 refund_payment_cents bigint check(refund_payment_cents >= 0),
 captured_at timestamptz not null,
 source_hash text not null,
 requested_end_date date,
 updated_at timestamptz not null default now(),
 primary key(device_id,shop_name,start_date,end_date),
 check(end_date >= start_date and end_date - start_date < 31),
 check(requested_end_date is null or requested_end_date >= end_date)
);
alter table public.acct_kuaishou_business_ranges enable row level security;
revoke all on public.acct_kuaishou_business_ranges from anon, authenticated;
grant all on public.acct_kuaishou_business_ranges to service_role;
create or replace function public.acct_kuaishou_keep_newer()
returns trigger language plpgsql set search_path = public as $$
begin
 if new.captured_at < old.captured_at then return old; end if;
 return new;
end;
$$;
revoke all on function public.acct_kuaishou_keep_newer() from public;
drop trigger if exists keep_newer on public.acct_kuaishou_business_ranges;
create trigger keep_newer before update on public.acct_kuaishou_business_ranges
for each row execute function public.acct_kuaishou_keep_newer();
