create table if not exists public.acct_business_ranges (
  device_id text not null references public.acct_devices(id),
  shop_name text not null,
  start_date date not null,
  end_date date not null,
  gross_cents bigint not null check(gross_cents >= 0),
  refund_payment_cents bigint check(refund_payment_cents >= 0),
  captured_at timestamptz not null,
  source_hash text not null,
  updated_at timestamptz not null default now(),
  primary key(device_id,shop_name,start_date,end_date),
  check(end_date >= start_date and end_date - start_date < 31)
);
alter table public.acct_business_ranges enable row level security;
revoke all on public.acct_business_ranges from anon, authenticated;
grant all on public.acct_business_ranges to service_role;
