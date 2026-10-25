-- EchoSync. Run as project owner in Supabase SQL Editor. Safe to run repeatedly.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null, display_name text not null, email text,
 taste_profile jsonb not null default '{}'::jsonb, liked_tracks jsonb not null default '[]'::jsonb,
 activity_status jsonb not null default '{}'::jsonb, privacy_settings jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.playlists (
 id text primary key, owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null, description text, visibility text not null default 'public' check(visibility in ('public','private')),
 tracks jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.rooms (
 id text primary key, code text unique not null, name text not null, tagline text, description text,
 gradient text, privacy text not null default 'public' check(privacy in ('public','private')), host_id text not null,
 current_track jsonb, playback_clock jsonb not null default '{}'::jsonb,
 queue jsonb not null default '[]'::jsonb, members jsonb not null default '[]'::jsonb, roles jsonb not null default '{}'::jsonb,
 metadata jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.messages (
 id text primary key, context_type text not null check(context_type in ('lounge','room')), context_id text not null,
 author_id text not null, author_handle text not null, author_name text not null,
 kind text not null default 'text' check(kind in ('text','song','voice','system')), text text,
 song_payload jsonb, voice_url text, voice_duration numeric, reply_to jsonb,
 reactions jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 check(context_type <> 'lounge' or context_id='public-lounge')
);
create index if not exists messages_context_created on public.messages(context_id,created_at desc);
create index if not exists playlists_owner on public.playlists(owner_id);
create or replace function public.echosync_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
do $$declare t text;begin foreach t in array array['profiles','playlists','rooms'] loop execute format('drop trigger if exists echosync_touch on public.%I',t);execute format('create trigger echosync_touch before update on public.%I for each row execute function public.echosync_updated_at()',t);end loop;end$$;

-- Definer helpers avoid recursive rooms policies. No caller-supplied user identity.
create or replace function public.echosync_member(p_room text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.rooms where id=p_room and members ? auth.uid()::text) $$;
create or replace function public.echosync_role(p_room text) returns text language sql stable security definer set search_path='' as $$ select case when members ? auth.uid()::text then roles->>auth.uid()::text end from public.rooms where id=p_room $$;
alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.rooms enable row level security;
alter table public.messages enable row level security;
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists playlists_read on public.playlists;
create policy playlists_read on public.playlists for select to anon,authenticated using(visibility='public' or owner_id=auth.uid());
drop policy if exists playlists_owner on public.playlists;
create policy playlists_owner on public.playlists for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select to anon,authenticated using(privacy='public' or public.echosync_member(id));
drop policy if exists rooms_host_write on public.rooms;
create policy rooms_host_write on public.rooms for all to authenticated using(host_id=auth.uid()::text) with check(host_id=auth.uid()::text);
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to anon,authenticated using(context_type='lounge' or public.echosync_member(context_id));
drop policy if exists messages_author on public.messages;
create policy messages_author on public.messages for all to authenticated using(author_id=auth.uid()::text and (context_type='lounge' or public.echosync_member(context_id))) with check(author_id=auth.uid()::text and (context_type='lounge' or public.echosync_member(context_id)));
-- Room/message mutations go through authorized RPCs, not direct table writes.
revoke all on public.rooms,public.messages from anon,authenticated;
grant select on public.rooms,public.messages to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.playlists to authenticated;
grant select on public.playlists to anon;
grant all on public.profiles,public.playlists,public.rooms,public.messages to service_role;

-- Public directory excludes email, liked_tracks and migration metadata.
create or replace view public.profile_directory as
 select id,username,display_name,
 case when (coalesce(privacy_settings->>'showActivity','true')='true') then taste_profile else '{}'::jsonb end as taste_profile,
 case when (coalesce(privacy_settings->>'showActivity','true')='true') then activity_status else '{}'::jsonb end as activity_status,
 jsonb_build_object('showActivity',(coalesce(privacy_settings->>'showActivity','true')='true'),'allowInvites',(coalesce(privacy_settings->>'allowInvites','true')='true')) as privacy_settings
 from public.profiles;
grant select on public.profile_directory to anon,authenticated;

create or replace function public.echosync_join_room(p_room_id text default null,p_code text default '') returns public.rooms language plpgsql security definer set search_path='' as $$
declare r public.rooms;u text:=auth.uid()::text;begin
 if u is null then raise exception 'Sign in to join a room';end if;
 select * into r from public.rooms where (p_room_id is not null and id=p_room_id) or (p_room_id is null and code=p_code) for update;
 if r.id is null or (r.privacy='private' and not(r.members ? u) and r.code<>coalesce(p_code,'')) then raise exception 'Room unavailable or invalid code';end if;
 if not(r.members ? u) then update public.rooms set members=members||jsonb_build_array(u),roles=roles||jsonb_build_object(u,'listener') where id=r.id returning * into r;end if;
 return r;
end$$;

create or replace function public.echosync_room_payload(r public.rooms) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(r.metadata,'{}'::jsonb)||jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'tagline',r.tagline,'description',r.description,'gradient',r.gradient,'private',r.privacy='private','createdBy',r.host_id,'dj',r.host_id,'trackIds',(select coalesce(jsonb_agg(t->'id'),'[]'::jsonb) from jsonb_array_elements(r.queue)t),'members',r.members,'roles',r.roles,'cloud',true)
$$;
create or replace function public.echosync_message_payload(m public.messages) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',m.id,'author',m.author_id,'authorHandle',m.author_handle,'userName',m.author_name,'type',m.kind,'system',m.kind='system','text',coalesce(m.text,''),'track',m.song_payload,'voiceData',m.voice_url,'duration',m.voice_duration,'replyTo',m.reply_to,'reactions',case when jsonb_typeof(m.reactions)='array' then m.reactions else '[]'::jsonb end,'createdAt',extract(epoch from m.created_at)*1000,'time',to_char(m.created_at,'HH24:MI'))
$$;
create or replace function public.echosync_rank_queue(q jsonb, clock jsonb,votes jsonb,original jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(item order by case when n<=coalesce((clock->>'index')::int,0)+1 then 0 else 1 end,
 case when n<=coalesce((clock->>'index')::int,0)+1 then n else null end,
 (select count(*) from jsonb_each(coalesce(votes->(item->>'id'),'{}'::jsonb)) v where v.value->>'active'='true') desc,
 coalesce((select ord from jsonb_array_elements_text(original) with ordinality a(id,ord) where a.id=item->>'id' limit 1),n)),'[]'::jsonb) from jsonb_array_elements(q) with ordinality x(item,n)
$$;

-- Only this RPC may publish cloud broadcasts. Client broadcast INSERT is denied below.
create or replace function public.echosync_event(p_event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb:=p_event;typ text:=p_event->>'type';u text:=auth.uid()::text;rid text:=coalesce(p_event->>'roomId',p_event#>>'{room,id}');topic text;role text;r public.rooms;c jsonb:=p_event->'cloudRoom';m public.messages;pr public.profiles;msg jsonb:=p_event->'message';ctx text;votes jsonb;old jsonb;change jsonb;tid text;emoji text;active boolean;users jsonb;reacts jsonb;inv jsonb;target text;recipient text;begin
 if u is null then raise exception 'Authentication required';end if;
 if octet_length(p_event::text)>262144 then raise exception 'Event too large';end if;
 select * into pr from public.profiles where id=auth.uid();if pr.id is null then raise exception 'Profile required';end if;
 e:=e-'_server';
 if rid is not null then select * into r from public.rooms where id=rid for update;role:=public.echosync_role(rid);end if;
 topic:=case when rid is null then 'echosync:lounge' else 'echosync:room:'||rid end;
 if typ='room-added' then
   if r.id is not null then if r.host_id<>u then raise exception 'Room id already owned';end if;return '{}'::jsonb;end if;
   if c->>'host_id'<>u then raise exception 'Cannot create another host room';end if;
   insert into public.rooms(id,code,name,tagline,description,gradient,privacy,host_id,queue,members,roles,metadata)
   values(rid,c->>'code',c->>'name',c->>'tagline',c->>'description',c->>'gradient',coalesce(c->>'privacy','public'),u,coalesce(c->'queue','[]'::jsonb),jsonb_build_array(u),jsonb_build_object(u,'admin'),coalesce(c->'metadata','{}'::jsonb)) returning * into r;
   e:=e||jsonb_build_object('room',public.echosync_room_payload(r),'cloudRoom',to_jsonb(r));
   topic:=case when r.privacy='public' then 'echosync:directory' else 'echosync:user:'||u end;
 elsif typ='room-updated' then
   if r.id is null then raise exception 'Room unavailable';end if;
   if not(r.members ? u) then r:=public.echosync_join_room(rid,p_event#>>'{room,code}');
   elsif not(coalesce((p_event#>'{room,members}') ? u,false)) then
     update public.rooms set members=members-u,roles=roles-u where id=rid returning * into r;
   elsif role='admin' then
     update public.rooms set name=c->>'name',tagline=c->>'tagline',description=c->>'description',privacy=coalesce(c->>'privacy',privacy),queue=coalesce(c->'queue',queue),members=coalesce(c->'members',members),roles=coalesce(c->'roles',roles),metadata=coalesce(c->'metadata',metadata) where id=rid returning * into r;
   elsif role='dj' then update public.rooms set queue=coalesce(c->'queue',queue) where id=rid returning * into r;
   else raise exception 'Only room controllers may update the queue';end if;
   e:=e||jsonb_build_object('room',public.echosync_room_payload(r),'cloudRoom',to_jsonb(r));
 elsif typ in ('state','FORCE_RESYNC') then
   if role is null or role not in ('admin','dj') then raise exception 'Controller role required';end if;
   if coalesce((e->>'time')::numeric,-1)<0 or abs(extract(epoch from now())*1000-(e->>'ts')::numeric)>15000 then raise exception 'Invalid clock';end if;
   if not coalesce((e->>'heartbeat')::boolean,false) or r.updated_at<now()-interval '5 seconds' then
     update public.rooms set playback_clock=e-'track',current_track=e->'track' where id=rid;
   end if;
   e:=e||jsonb_build_object('userId',u);
 elsif typ='room-vote' then
   if role is null then raise exception 'Room membership required';end if;
   tid:=e->>'trackId';change:=e->'change';votes:=coalesce(r.metadata->'queueVotes','{}'::jsonb);old:=votes#>array[tid,u];
   if not exists(select 1 from jsonb_array_elements(r.queue) with ordinality a(t,n) where t->>'id'=tid and n>coalesce((r.playback_clock->>'index')::int,0)+1) then raise exception 'Only upcoming tracks can be voted';end if;
   if old is null or (change->>'ts')::numeric>(old->>'ts')::numeric or ((change->>'ts')::numeric=(old->>'ts')::numeric and change->>'op'>old->>'op') then
     votes:=jsonb_set(votes,array[tid],coalesce(votes->tid,'{}'::jsonb)||jsonb_build_object(u,change),true);
     update public.rooms set metadata=jsonb_set(metadata,'{queueVotes}',votes,true),queue=public.echosync_rank_queue(queue,playback_clock,votes,coalesce(metadata->'queueOrder','[]'::jsonb)) where id=rid;
   end if;
   e:=e||jsonb_build_object('userId',u);
 elsif typ in ('lounge-message','chat') then
   if coalesce((msg->>'system')::boolean,false) and role is null then return '{}'::jsonb;end if;
   if rid is not null and role is null then raise exception 'Room membership required';end if;
   if coalesce((msg->>'system')::boolean,false) and role='listener' then msg:=jsonb_set(msg,'{text}',to_jsonb(pr.display_name||' joined the room'));end if;
   if msg->>'type'='voice' and not exists(select 1 from storage.objects where bucket_id='voice-notes' and name=split_part(msg->>'voiceData','/storage/v1/object/public/voice-notes/',2) and (storage.foldername(name))[1]=u) then raise exception 'Upload a voice note owned by you first';end if;
   ctx:=coalesce(rid,'public-lounge');
   insert into public.messages(id,context_type,context_id,author_id,author_handle,author_name,kind,text,song_payload,voice_url,voice_duration,reply_to,reactions)
   values(msg->>'id',case when rid is null then 'lounge' else 'room' end,ctx,u,pr.username,pr.display_name,case when coalesce((msg->>'system')::boolean,false) then 'system' else coalesce(msg->>'type','text') end,left(coalesce(msg->>'text',''),1000),msg->'track',case when msg->>'type'='voice' then msg->>'voiceData' end,(msg->>'duration')::numeric,msg->'replyTo','[]'::jsonb)
   on conflict(id) do nothing;
   select * into m from public.messages where id=msg->>'id';if m.author_id<>u or m.context_id<>ctx then raise exception 'Message id already owned';end if;
   e:=e||jsonb_build_object('message',public.echosync_message_payload(m));
 elsif typ in ('lounge-delete','chat-delete') then
   select * into m from public.messages where id=e->>'messageId';
   if m.id is null then return '{}'::jsonb;end if;
   if m.context_type='room' and not public.echosync_member(m.context_id) then raise exception 'Room membership required';end if;
   if m.author_id<>u and coalesce(public.echosync_role(m.context_id),'')<>'admin' then raise exception 'Cannot delete another author message';end if;
   delete from public.messages where id=m.id;topic:=case when m.context_type='lounge' then 'echosync:lounge' else 'echosync:room:'||m.context_id end;
 elsif typ in ('lounge-reaction','chat-reaction') then
   select * into m from public.messages where id=e->>'messageId' for update;
   if m.id is null or (m.context_type='room' and not public.echosync_member(m.context_id)) then raise exception 'Message unavailable';end if;
   emoji:=left(e->>'emoji',16);active:=coalesce((e->>'active')::boolean,false);reacts:=case when jsonb_typeof(m.reactions)='array' then m.reactions else '[]'::jsonb end;
   select value into old from jsonb_array_elements(reacts) where value->>'emoji'=emoji;
   users:=coalesce(old->'userIds','[]'::jsonb)-u;if active then users:=users||jsonb_build_array(u);end if;
   select coalesce(jsonb_agg(value),'[]'::jsonb) into reacts from jsonb_array_elements(reacts) where value->>'emoji'<>emoji;
   if jsonb_array_length(users)>0 then reacts:=reacts||jsonb_build_array(jsonb_build_object('emoji',emoji,'userIds',users,'count',jsonb_array_length(users)));end if;
   update public.messages set reactions=reacts where id=m.id returning * into m;
   e:=e||jsonb_build_object('userId',u,'userName',pr.display_name,'type',case when m.context_type='lounge' then 'lounge-message' else 'chat-updated' end,'message',public.echosync_message_payload(m),'roomId',case when m.context_type='room' then m.context_id end);
   topic:=case when m.context_type='lounge' then 'echosync:lounge' else 'echosync:room:'||m.context_id end;
 elsif typ='channel-profile' then
   e:=e||jsonb_build_object('profile',jsonb_build_object('userId',u,'ts',extract(epoch from now())*1000,'sharing',(coalesce(pr.privacy_settings->>'showActivity','true')='true'),'taste',case when (coalesce(pr.privacy_settings->>'showActivity','true')='true') then pr.taste_profile else '{}'::jsonb end,'rotation',case when (coalesce(pr.privacy_settings->>'showActivity','true')='true') then coalesce(pr.activity_status->'rotation','[]'::jsonb) else '[]'::jsonb end,'activity',case when (coalesce(pr.privacy_settings->>'showActivity','true')='true') then pr.activity_status->'track' end,'room',case when (coalesce(pr.privacy_settings->>'showActivity','true')='true') then pr.activity_status->'room' end,'playlists',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'visibility',visibility,'tracks',tracks)),'[]'::jsonb) from public.playlists where owner_id=auth.uid() and visibility='public')));
   topic:='echosync:lounge';
 elsif typ in ('invite','room-invite') then
   inv:=e->'invite';rid:=inv->>'roomId';select * into r from public.rooms where id=rid;
   if coalesce(public.echosync_role(rid),'')<>'admin' then raise exception 'Admin role required';end if;
   target:=inv->>'toUserId';if not exists(select 1 from public.profiles where id::text=target and (coalesce(privacy_settings->>'allowInvites','true')='true')) then raise exception 'Invites closed';end if;
   perform realtime.send(jsonb_build_object('_server',true,'type','room-added','sender','cloud-invite','room',public.echosync_room_payload(r),'cloudRoom',to_jsonb(r)),'event','echosync:user:'||target,true);
   e:=e||jsonb_build_object('invite',inv||jsonb_build_object('fromId',u,'fromHandle',pr.username,'roomCode',r.code));topic:='echosync:user:'||target;
 elsif typ='room-deleted' then
   if r.id is null or r.host_id is distinct from u then raise exception 'Host required';end if;delete from public.rooms where id=rid;delete from public.messages where context_type='room' and context_id=rid;
 elsif typ in ('role-resolved','member-changed') then
   if role is distinct from 'admin' then raise exception 'Admin role required';end if;
   update public.rooms set roles=coalesce(e->'roles',roles),members=coalesce(e->'members',members) where id=rid;
 elsif typ='role-request' then
   if role is null or e#>>'{request,userId}'<>u then raise exception 'Invalid role request';end if;
   update public.rooms set metadata=jsonb_set(metadata,'{requests}',coalesce(metadata->'requests','[]'::jsonb)||jsonb_build_array(e->'request'),true) where id=rid;
 elsif typ in ('member-telemetry','typing','voice-live-start','voice-chunk','voice-live-stop','join-sync-request') then
   if role is null then raise exception 'Room membership required';end if;e:=e||jsonb_build_object('userId',u);
 elsif typ in ('lounge-typing','invite-resolved') then
   e:=e||jsonb_build_object('userId',u);topic:='echosync:lounge';
 else raise exception 'Unsupported cloud event: %',typ;end if;
 e:=e||jsonb_build_object('_server',true);
 if topic like 'echosync:room:%' then
   -- Fan out sensitive traffic through member inboxes. A removed subscriber's
   -- cached topic authorization cannot expose future room messages.
   for recipient in select jsonb_array_elements_text(coalesce((select members from public.rooms where id=rid),r.members,'[]'::jsonb)) loop
     perform realtime.send(e,'event','echosync:user:'||recipient,true);
   end loop;
 else perform realtime.send(e,'event',topic,true);end if;
 return e;
end$$;

-- Service-side retention updates and deletes also reach connected clients.
create or replace function public.echosync_message_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data public.messages;e jsonb;recipient text;begin
 if tg_op='DELETE' then row_data:=old;e:=jsonb_build_object('_server',true,'sender','cloud-db','type',case when old.context_type='lounge' then 'lounge-delete' else 'chat-delete' end,'messageId',old.id,'roomId',old.context_id);
 else row_data:=new;e:=jsonb_build_object('_server',true,'sender','cloud-db','type',case when new.context_type='lounge' then 'lounge-message' else 'chat-updated' end,'message',public.echosync_message_payload(new),'roomId',new.context_id);end if;
 if row_data.context_type='lounge' then perform realtime.send(e,'event','echosync:lounge',true);
 else for recipient in select jsonb_array_elements_text(members) from public.rooms where id=row_data.context_id loop perform realtime.send(e,'event','echosync:user:'||recipient,true);end loop;end if;
 return null;
end$$;
drop trigger if exists echosync_message_updates on public.messages;
create trigger echosync_message_updates after update or delete on public.messages for each row execute function public.echosync_message_changed();

-- Commit an owner's complete library atomically, so Realtime never observes a
-- new profile with an old/half-written playlist set.
create or replace function public.echosync_save_library(p_profile jsonb,p_playlists jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p jsonb;begin
 if u is null or p_profile->>'id' is distinct from u::text then raise exception 'Owner identity required';end if;
 update public.profiles set liked_tracks=coalesce(p_profile->'liked_tracks','[]'::jsonb),taste_profile=coalesce(p_profile->'taste_profile','{}'::jsonb),activity_status=coalesce(p_profile->'activity_status','{}'::jsonb),privacy_settings=privacy_settings||coalesce(p_profile->'privacy_settings','{}'::jsonb) where id=u;
 if not found then raise exception 'Profile required';end if;
 for p in select value from jsonb_array_elements(p_playlists) loop
   if exists(select 1 from public.playlists where id=p->>'id' and owner_id<>u) then raise exception 'Playlist id already owned';end if;
   insert into public.playlists(id,owner_id,name,description,visibility,tracks) values(p->>'id',u,p->>'name',p->>'description',coalesce(p->>'visibility','public'),coalesce(p->'tracks','[]'::jsonb))
   on conflict(id) do update set name=excluded.name,description=excluded.description,visibility=excluded.visibility,tracks=excluded.tracks;
 end loop;
 delete from public.playlists where owner_id=u and not exists(select 1 from jsonb_array_elements(p_playlists) x where x->>'id'=playlists.id);
end$$;
revoke all on function public.echosync_save_library(jsonb,jsonb) from public,anon;
grant execute on function public.echosync_save_library(jsonb,jsonb) to authenticated;

-- No ALTER TABLE on realtime.messages: Supabase owns it and already enables RLS.
drop policy if exists echosync_receive on realtime.messages;
create policy echosync_receive on realtime.messages for select to anon,authenticated using(
 realtime.topic() in ('echosync:lounge','echosync:directory') or
 (auth.uid() is not null and (realtime.topic()='echosync:user:'||auth.uid()::text or public.echosync_member(substring(realtime.topic() from '^echosync:room:(.*)$'))))
);
drop policy if exists echosync_presence on realtime.messages;
create policy echosync_presence on realtime.messages for insert to authenticated with check(extension='presence' and (realtime.topic()='echosync:lounge' or realtime.topic()='echosync:user:'||auth.uid()::text or public.echosync_member(substring(realtime.topic() from '^echosync:room:(.*)$'))));
-- There intentionally is no client broadcast INSERT policy.
create or replace function public.echosync_directory_changed() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform realtime.send(jsonb_build_object('_server',true,'type','directory-changed'),'event','echosync:directory',true);return null;end$$;
do $$declare t text;begin foreach t in array array['profiles','playlists','rooms'] loop execute format('drop trigger if exists echosync_directory on public.%I',t);execute format('create trigger echosync_directory after insert or update or delete on public.%I for each statement execute function public.echosync_directory_changed()',t);end loop;end$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('voice-notes','voice-notes',true,10485760,array['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg']) on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists voice_notes_read on storage.objects;
create policy voice_notes_read on storage.objects for select to anon,authenticated using(bucket_id='voice-notes');
drop policy if exists voice_notes_insert on storage.objects;
create policy voice_notes_insert on storage.objects for insert to authenticated with check(bucket_id='voice-notes' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists voice_notes_delete on storage.objects;
create policy voice_notes_delete on storage.objects for delete to authenticated using(bucket_id='voice-notes' and (storage.foldername(name))[1]=auth.uid()::text);
-- Never DELETE storage.objects via SQL: that orphans the physical file.
create or replace function public.echosync_expired_voice_notes() returns table(name text) language sql stable security definer set search_path='' as $$select name from storage.objects where bucket_id='voice-notes' and created_at<now()-interval '24 hours' order by created_at limit 500$$;
revoke all on function public.echosync_expired_voice_notes() from public,anon,authenticated;
grant execute on function public.echosync_expired_voice_notes() to service_role;
-- Restrict definer mutation functions; only signed-in callers may invoke them.
revoke all on function public.echosync_event(jsonb),public.echosync_join_room(text,text) from public,anon;
grant execute on function public.echosync_event(jsonb),public.echosync_join_room(text,text) to authenticated;
commit;

-- 24-hour cleanup candidate helper (service-role only):
-- select * from public.echosync_expired_voice_notes();
-- Deploy supabase/functions/cleanup-voice-notes and schedule it hourly in Supabase Cron.
-- The function removes bytes through Storage API, then preserves chat with an expiry notice.

-- Optional hourly scheduler after deploying cleanup-voice-notes and enabling
-- pg_cron/pg_net. Put the URL and server-only key in Vault first (see setup doc).
-- select cron.schedule('echosync-voice-cleanup','0 * * * *',$job$
-- select net.http_post(
--   url := (select decrypted_secret from vault.decrypted_secrets where name='echosync_project_url') || '/functions/v1/cleanup-voice-notes',
--   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='echosync_cleanup_service_key')),
--   body := '{}'::jsonb);
-- $job$);
