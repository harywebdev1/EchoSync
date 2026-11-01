do $migration$
declare source text:=pg_get_functiondef('public.echosync_event(jsonb)'::regprocedure);
begin
 if position($patch$jsonb_build_object('time',e->'time','ts',e->'ts','heartbeat',true)$patch$ in source)=0 then raise exception 'Heartbeat guard changed; review migration';end if;
 execute replace(source,$patch$jsonb_build_object('time',e->'time','ts',e->'ts','heartbeat',true)$patch$,$patch$jsonb_build_object('type','state','command','POSITION','time',e->'time','ts',e->'ts','heartbeat',true,'sender',e->'sender','_eventId',e->'_eventId')$patch$);
end $migration$;
