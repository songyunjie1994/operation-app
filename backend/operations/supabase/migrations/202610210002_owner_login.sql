begin;
create table if not exists public.ops_owner_identity (
 email_hash text primary key check(email_hash ~ '^[a-f0-9]{64}$')
);
alter table public.ops_owner_identity enable row level security;
revoke all on public.ops_owner_identity from anon,authenticated;
grant all on public.ops_owner_identity to service_role;
create or replace function public.ops_accept_verified_owner()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin
 if new.email_confirmed_at is not null and exists(
  select 1 from public.ops_owner_identity where email_hash=encode(digest(lower(new.email),'sha256'),'hex')
 ) then
  insert into public.ops_members(user_id,role,enabled) values(new.id,'admin',true)
  on conflict(user_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.ops_accept_verified_owner() from public,anon,authenticated;
drop trigger if exists ops_verified_owner on auth.users;
create trigger ops_verified_owner after insert or update of email_confirmed_at on auth.users
for each row execute function public.ops_accept_verified_owner();
commit;
