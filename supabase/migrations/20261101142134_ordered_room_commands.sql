-- Preserve the deployed RPC's existing membership, privacy and room policies.
do $migration$
declare source text:=pg_get_functiondef('public.echosync_event(jsonb)'::regprocedure);
begin
 if position($patch$recipient text;begin$patch$ in source)=0 then raise exception 'Room RPC changed; review migration';end if;
 source:=replace(source,$patch$recipient text;begin$patch$,$patch$recipient text;v numeric;saved numeric;begin$patch$);
 if position($patch$ topic:=case when rid is null then 'echosync:lounge' else 'echosync:room:'||rid end;$patch$ in source)=0 then raise exception 'Room RPC changed; review migration';end if;
 source:=replace(source,$patch$ topic:=case when rid is null then 'echosync:lounge' else 'echosync:room:'||rid end;$patch$,$patch$
 -- Server-authoritative actor and one monotonic command order across queue/roles/playback.
 if rid is not null and r.id is not null and typ in ('state','FORCE_RESYNC','room-updated','role-resolved','member-changed') then
   v:=coalesce((e->>'stateVersion')::numeric,(e->>'ts')::numeric,extract(epoch from clock_timestamp())*1000);
   saved:=greatest(coalesce((r.metadata->>'stateVersion')::numeric,0),coalesce((r.playback_clock->>'stateVersion')::numeric,0));
   if v>extract(epoch from clock_timestamp())*1000+15000 or v<0 then raise exception 'Invalid command version';end if;
   if v<saved or (v=saved and u<coalesce(r.metadata->>'lastActorId','')) then return jsonb_build_object('_discarded',true);end if;
   e:=e||jsonb_build_object('stateVersion',v,'lastActorId',u);
 end if;
 topic:=case when rid is null then 'echosync:lounge' else 'echosync:room:'||rid end;$patch$);
 if position($patch$   if not coalesce((e->>'heartbeat')::boolean,false) or r.updated_at<now()-interval '5 seconds' then
     update public.rooms set playback_clock=e-'track',current_track=e->'track' where id=rid;
   end if;$patch$ in source)=0 then raise exception 'Room RPC changed; review migration';end if;
 source:=replace(source,$patch$   if not coalesce((e->>'heartbeat')::boolean,false) or r.updated_at<now()-interval '5 seconds' then
     update public.rooms set playback_clock=e-'track',current_track=e->'track' where id=rid;
   end if;$patch$,$patch$   if coalesce((e->>'heartbeat')::boolean,false) then
     if r.playback_clock->>'lastActorId' is distinct from u or not coalesce((r.playback_clock->>'isPlaying')::boolean,false) or v<>coalesce((r.playback_clock->>'stateVersion')::numeric,0) then return jsonb_build_object('_discarded',true);end if;
     e:=r.playback_clock||jsonb_build_object('time',e->'time','ts',e->'ts','heartbeat',true);
     update public.rooms set playback_clock=e where id=rid;
   else
     update public.rooms set playback_clock=e-'track',current_track=e->'track' where id=rid;
   end if;$patch$);
 if position($patch$ e:=e||jsonb_build_object('_server',true);$patch$ in source)=0 then raise exception 'Room RPC changed; review migration';end if;
 source:=replace(source,$patch$ e:=e||jsonb_build_object('_server',true);$patch$,$patch$ if rid is not null and v is not null and not coalesce((e->>'heartbeat')::boolean,false) then
   update public.rooms set metadata=metadata||jsonb_build_object('stateVersion',v,'lastActorId',u) where id=rid returning * into r;
   if e ? 'room' then e:=e||jsonb_build_object('room',public.echosync_room_payload(r),'cloudRoom',to_jsonb(r));end if;
 end if;
 e:=e||jsonb_build_object('_server',true);$patch$);
 execute source;
end $migration$;
