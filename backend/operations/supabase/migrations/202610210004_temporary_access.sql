begin;
alter table public.ops_members add column if not exists valid_until timestamptz;
create or replace function public.ops_can_read() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.ops_members where user_id=auth.uid() and enabled and (valid_until is null or valid_until>now()));
$$;
revoke all on function public.ops_can_read() from public,anon;
grant execute on function public.ops_can_read() to authenticated;
commit;
