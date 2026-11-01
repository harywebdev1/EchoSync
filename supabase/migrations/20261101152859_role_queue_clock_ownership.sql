-- Queue/role commands transfer position-heartbeat ownership without changing transport.
do $migration$
declare definition text; original text; replacement text;
begin
  definition:=pg_get_functiondef('public.echosync_event(jsonb)'::regprocedure);
  original:=$old$update public.rooms set metadata=metadata||jsonb_build_object('stateVersion',v,'lastActorId',u) where id=rid returning * into r;$old$;
  replacement:=$new$update public.rooms set metadata=metadata||jsonb_build_object('stateVersion',v,'lastActorId',u),playback_clock=playback_clock||jsonb_build_object('stateVersion',v,'lastActorId',u) where id=rid returning * into r;$new$;
  if position(original in definition)=0 then raise exception 'Unexpected room command function; inspect before migrating';end if;
  execute replace(definition,original,replacement);
end $migration$;
