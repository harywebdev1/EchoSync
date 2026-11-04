-- Expire Lounge media through the existing Storage API cleanup worker.
-- Keep every blob still referenced by a Room message.
create index if not exists messages_room_voice_path_idx on public.messages ((split_part(voice_url,'/voice-notes/',2))) where context_type='room' and voice_url is not null;
create or replace function public.echosync_expired_voice_notes()
returns table(name text) language sql stable security definer set search_path='' as $$
 select o.name from storage.objects o
 where o.bucket_id='voice-notes' and o.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.messages m where m.context_type='room' and m.voice_url is not null and split_part(m.voice_url,'/voice-notes/',2)=o.name)
 order by o.created_at limit 500
$$;
revoke all on function public.echosync_expired_voice_notes() from public,anon,authenticated;
grant execute on function public.echosync_expired_voice_notes() to service_role;
do $$ declare job_id bigint; begin
 select jobid into job_id from cron.job where jobname='echosync-voice-cleanup';
 if job_id is not null then perform cron.alter_job(job_id,schedule := '* * * * *'); end if;
end $$;
