-- Only the disposable public conversation has a retention deadline.
create index if not exists messages_lounge_expiry_idx on public.messages (created_at) where context_type = 'lounge';
create or replace function public.echosync_prune_lounge()
returns bigint language plpgsql security definer set search_path = '' as $$
declare removed bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.messages where context_type = 'lounge' and created_at < now() - interval '24 hours';
  get diagnostics removed = row_count;
  return removed;
end; $$;
revoke all on function public.echosync_prune_lounge() from public, anon;
grant execute on function public.echosync_prune_lounge() to authenticated;
create or replace function public.echosync_prune_lounge_on_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.messages where context_type = 'lounge' and created_at < now() - interval '24 hours';
  return null;
end; $$;
revoke all on function public.echosync_prune_lounge_on_post() from public, anon, authenticated;
drop trigger if exists prune_expired_lounge_on_post on public.messages;
create trigger prune_expired_lounge_on_post after insert on public.messages for each statement execute function public.echosync_prune_lounge_on_post();
select cron.schedule('echosync-lounge-expiry', '* * * * *', $job$delete from public.messages where context_type='lounge' and created_at < now() - interval '24 hours'$job$);
