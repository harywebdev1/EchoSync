-- Runs against the actual RPC and rolls back all QA identities, rooms and broadcasts.
begin;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();rid text:='qa-overhaul-'||gen_random_uuid()::text;v numeric:=floor(extract(epoch from clock_timestamp())*1000);r public.rooms;result jsonb;begin
 insert into auth.users(id,email,raw_user_meta_data) values(a,'qa-'||a||'@example.invalid',jsonb_build_object('username','qa_'||left(a::text,8))),(b,'qa-'||b||'@example.invalid',jsonb_build_object('username','qa_'||left(b::text,8)));
 insert into public.profiles(id,username,display_name) values(a,'qa_'||left(a::text,8),'QA Admin'),(b,'qa_'||left(b::text,8),'QA DJ') on conflict(id) do nothing;
 insert into public.rooms(id,code,name,privacy,host_id,members,roles,queue) values(rid,'ES-QA-'||left(a::text,8),'Overhaul transaction test','private',a::text,jsonb_build_array(a::text,b::text),jsonb_build_object(a::text,'admin',b::text,'listener'),'[{"id":"first","title":"First","duration":180},{"id":"second","title":"Second","duration":180}]'::jsonb);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.echosync_event(jsonb_build_object('type','state','roomId',rid,'stateVersion',v,'lastActorId',a,'ts',v,'index',0,'trackId','first','time',0,'isPlaying',true));
 select * into r from public.rooms where id=rid;
 perform public.echosync_event(jsonb_build_object('type','room-updated','roomId',rid,'stateVersion',v+1,'room',jsonb_build_object('id',rid,'members',r.members),'cloudRoom',to_jsonb(r)||jsonb_build_object('roles',jsonb_build_object(a::text,'admin',b::text,'dj'))));
 result:=public.echosync_event(jsonb_build_object('type','state','roomId',rid,'stateVersion',v+1,'ts',v,'index',1,'trackId','second','time',1,'isPlaying',false,'heartbeat',true));
 if coalesce((result->>'_discarded')::boolean,false) then raise exception 'Role change stranded heartbeat ownership';end if;
 select * into r from public.rooms where id=rid;
 if r.playback_clock->>'trackId'<>'first' or not (r.playback_clock->>'isPlaying')::boolean then raise exception 'Role heartbeat changed transport';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.echosync_event(jsonb_build_object('type','state','roomId',rid,'stateVersion',v+2,'ts',v,'index',0,'trackId','first','time',4,'isPlaying',false));
 perform set_config('request.jwt.claim.sub',a::text,true);
 result:=public.echosync_event(jsonb_build_object('type','state','roomId',rid,'stateVersion',v,'ts',v,'index',0,'trackId','first','time',5,'isPlaying',true,'heartbeat',true));
 if not coalesce((result->>'_discarded')::boolean,false) then raise exception 'Stale heartbeat accepted';end if;
 select * into r from public.rooms where id=rid;
 if (r.playback_clock->>'isPlaying')::boolean then raise exception 'Paused room resumed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.echosync_event(jsonb_build_object('type','state','roomId',rid,'stateVersion',v+3,'ts',v,'command','SEEK','_eventId','track-command','index',1,'trackId','second','time',0,'isPlaying',true));
 -- A heartbeat may update position, never transport fields supplied by a stale tab.
 perform public.echosync_event(jsonb_build_object('type','state','roomId',rid,'stateVersion',v+3,'ts',v,'_eventId','position-command','index',0,'trackId','first','time',1,'isPlaying',false,'heartbeat',true));
 select * into r from public.rooms where id=rid;
 if r.playback_clock->>'command'<>'POSITION' or r.playback_clock->>'_eventId'<>'position-command' then raise exception 'Heartbeat replayed explicit seek or event id';end if;
 if r.playback_clock->>'trackId'<>'second' or not (r.playback_clock->>'isPlaying')::boolean then raise exception 'Heartbeat overwrote newer track/play state';end if;
end $test$;
rollback;
select 'PASS real RPC: DJ promotion, pause, stale heartbeat rejection, track change and position-only heartbeat; all QA data rolled back' as verification;
