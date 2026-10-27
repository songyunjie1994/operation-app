begin;
alter table public.ops_business add column if not exists daily_rows jsonb
 check(daily_rows is null or (jsonb_typeof(daily_rows)='array' and jsonb_array_length(daily_rows) between 1 and 31));
comment on column public.ops_business.daily_rows is 'Verified workbook rows for carrier all and placement unlimited; absent stays null.';
commit;
