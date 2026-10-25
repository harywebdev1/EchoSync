const assert=require('node:assert/strict'),fs=require('node:fs')
let passed=0
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
;(async()=>{
 const audioFixture='data:audio/wav;base64,'+require('./integrity-fixtures.cjs').wav(2).toString('base64')
 const {PGlite}=await import('@electric-sql/pglite')
 const {createCloudAdapter}=await import('./src/cloud/cloudAdapter.js')
 const {createRealtimeTransport}=await import('./src/cloud/realtimeTransport.js')
 const {isSupabaseConfigured}=await import('./src/lib/supabaseClient.js')
 const db=new PGlite(), ids={a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',c:'33333333-3333-4333-8333-333333333333'}
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to public;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;grant select,insert,delete on storage.objects to authenticated;create schema realtime;create table realtime.messages(extension text,topic text);insert into realtime.messages values('broadcast','probe');alter table realtime.messages enable row level security;grant select,insert on realtime.messages to anon,authenticated;create function realtime.topic() returns text language sql as $$select current_setting('realtime.topic',true)$$;create table public.test_broadcast(seq bigserial primary key,payload jsonb,event text,topic text);create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$insert into public.test_broadcast(payload,event,topic) values($1,$2,$3)$$;grant usage on schema realtime,storage to anon,authenticated;`)
 const sql=fs.readFileSync('supabase/schema.sql','utf8')
 await check('schema executes twice: tables, indexes, bucket, RLS, RPCs and triggers are idempotent',async()=>{await db.exec(sql);await db.exec(sql);for(const id of Object.values(ids))await db.query('insert into auth.users values($1)',[id]);const policies=await db.query('select policyname from pg_policies');assert.ok(policies.rows.length>=12);const bucket=await db.query("select public from storage.buckets where id='voice-notes'");assert.equal(bucket.rows[0].public,true)})
 let serial=Promise.resolve(),lastSeq=0;const subscriptions=new Set(),files=new Map()
 function run(id,fn){const action=serial.then(async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));try{return await fn()}finally{await db.exec('reset role');const rows=(await db.query('select * from public.test_broadcast where seq>$1 order by seq',[lastSeq])).rows;for(const row of rows){lastSeq=Number(row.seq);for(const sub of subscriptions)if(sub.active&&sub.topic===row.topic)queueMicrotask(()=>sub.handlers.broadcast?.({payload:row.payload}))}}});serial=action.catch(()=>{});return action}
 const clean=name=>{assert.match(name,/^[a-z_]+$/);return name}
 function client(id){let session={user:{id,email:id.slice(0,4)+'@example.test',user_metadata:{username:'user_'+id.slice(0,4)}}};const listeners=new Set();const instance={failedUpload:false,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>{listeners.add(fn);return{data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}}},signInWithPassword:async input=>{assert.ok(input.password);return{data:{session,user:session.user}}},signUp:async input=>({data:{session,user:{...session.user,user_metadata:input.options.data}}}),signInWithOAuth:async input=>({data:input}),signOut:async()=>{session=null;listeners.forEach(fn=>fn('SIGNED_OUT',null));return{error:null}},updateUser:async input=>({data:{user:{...session.user,...input}}})},
 from(table){clean(table);let op='select',value,columns='*',filters=[],sort,limit,single=false;const builder={select(c='*'){columns=c;return builder},eq(k,v){filters.push([clean(k),'=',v]);return builder},in(k,v){filters.push([clean(k),'in',v]);return builder},order(k,{ascending}){sort=clean(k)+(ascending?' asc':' desc');return builder},limit(n){limit=Number(n);return builder},maybeSingle(){single=true;return builder},upsert(v){op='upsert';value=v;return builder},update(v){op='update';value=v;return builder},delete(){op='delete';return builder},then(resolve,reject){return run(id,async()=>{try{let params=[];const val=v=>{params.push(v&&typeof v==='object'?JSON.stringify(v):v);return '$'+params.length};let statement;if(op==='upsert'){const keys=Object.keys(value).map(clean);statement=`insert into public.${table}(${keys.join(',')}) values(${keys.map(k=>val(value[k])).join(',')}) on conflict(id) do update set ${keys.filter(k=>k!=='id').map(k=>k+'=excluded.'+k).join(',')} returning *`}else{statement=op==='select'?`select ${columns} from public.${table}`:op==='delete'?`delete from public.${table}`:`update public.${table} set ${Object.keys(value).map(k=>clean(k)+'='+val(value[k])).join(',')}`;if(filters.length)statement+=' where '+filters.map(([k,type,v])=>type==='in'?`${k} in (${v.map(val).join(',')})`:`${k}=${val(v)}`).join(' and ');if(sort)statement+=' order by '+sort;if(limit)statement+=' limit '+limit;if(op!=='select')statement+=' returning *'}const result=await db.query(statement,params);return{data:single?(result.rows[0]||null):result.rows,error:null}}catch(error){return{data:null,error:{message:error.message}}}}).then(resolve,reject)}};return builder},
 rpc(name,args){return run(id,async()=>{try{const keys=Object.keys(args||{}),result=await db.query(`select public.${clean(name)}(${keys.map((k,i)=>clean(k)+'=> $'+(i+1)).join(',')}) as data`,keys.map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]));return{data:result.rows[0]?.data,error:null}}catch(error){return{data:null,error:{message:error.message}}}})},
 channel(topic){const sub={topic,handlers:{},active:false,on(type,options,fn){sub.handlers[type]=fn;return sub},subscribe(fn){run(id,async()=>{await db.query("select set_config('realtime.topic',$1,false)",[topic]);const allowed=(await db.query('select count(*)::int as n from realtime.messages')).rows[0].n>0;sub.active=allowed;subscriptions.add(sub);fn(allowed?'SUBSCRIBED':'CHANNEL_ERROR')}).catch(()=>fn('CHANNEL_ERROR'));return sub},track:async data=>{sub.presence=data;for(const peer of subscriptions)if(peer.active&&peer.topic===topic)peer.handlers.presence?.();return{}},untrack:async()=>{sub.presence=null;for(const peer of subscriptions)if(peer.active&&peer.topic===topic)peer.handlers.presence?.();return{}},presenceState:()=>Object.fromEntries([...subscriptions].filter(peer=>peer.active&&peer.topic===topic&&peer.presence).map((peer,index)=>[index,[peer.presence]])),};return sub},removeChannel:async sub=>{sub.active=false;subscriptions.delete(sub)},
 storage:{from(bucket){assert.equal(bucket,'voice-notes');return {upload:async(path,blob,options)=>{if(instance.failedUpload)return{error:{message:'fixture upload unavailable'}};try{assert.equal(path.split('/')[0],id);assert.ok(blob.size>0);await run(id,()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,path]));files.set(path,blob);return{data:{path}}}catch(error){return{error:{message:error.message}}}},getPublicUrl:path=>({data:{publicUrl:'https://cloud.test/storage/v1/object/public/voice-notes/'+path}})}}}}
 return instance}
 const a=client(ids.a),b=client(ids.b),c=client(ids.c),A=createCloudAdapter(a),B=createCloudAdapter(b),C=createCloudAdapter(c)
 const tracks=[{id:'one',title:'One',artist:'Artist',duration:180,streamUrl:'https://audio.test/one'},{id:'two',title:'Two',artist:'Artist',duration:180},{id:'three',title:'Three',artist:'Artist',duration:180}],library=Object.fromEntries(tracks.map(t=>[t.id,t]))
 await check('cloud email/password, Google redirect and first-login migration are idempotent; passwords stay out of profiles',async()=>{
 assert.ok((await A.authenticate('signin',{identifier:'a@example.test',password:'secret'})).session)
 assert.ok((await A.authenticate('signup',{email:'a@example.test',password:'secret',username:'alice'})).session)
 assert.deepEqual(await A.google('https://echo.test'),{provider:'google',options:{redirectTo:'https://echo.test'}})
 const local={likes:[tracks[0]],taste:{artists:{artist:{name:'Artist',weight:10}},tuned:['lofi-chill'],events:4,searches:[{query:'sufi',at:123}]},playlists:[{id:'public',name:'Public',trackIds:['one']},{id:'private',name:'Private',visibility:'private',trackIds:['two']}],library}
 const data=await A.hydrate((await a.auth.getSession()).data.session.user,local);assert.equal(data.profile.liked_tracks.length,1);assert.equal(data.playlists.length,2);assert.deepEqual(data.profile.taste_profile.tuned,['lofi-chill']);assert.equal(data.profile.taste_profile.events,4)
 const again=await A.hydrate((await a.auth.getSession()).data.session.user,local);assert.equal(again.playlists.length,2);assert.equal(again.profile.liked_tracks.length,1);assert.ok(!JSON.stringify(data.profile).includes('secret'))
 await B.hydrate((await b.auth.getSession()).data.session.user);await C.hydrate((await c.auth.getSession()).data.session.user)
 })
 await check('real PostgreSQL RLS hides private playlists, owner email and liked tracks; denies foreign writes',async()=>{
 const visible=await B.playlists();assert.equal(visible.filter(p=>p.owner_id===ids.a).length,1)
 const rows=await run(ids.b,()=>db.query('select * from public.profiles where id=$1',[ids.a]));assert.equal(rows.rows.length,0)
 const directory=await B.directory();assert.ok(!('email' in directory[0]));assert.ok(!('liked_tracks'in directory[0]))
 const result=await b.from('playlists').update({name:'stolen'}).eq('id',ids.a+':private');assert.equal(result.data.length,0)
 const invalid=await b.from('profiles').upsert({id:ids.a,username:'stolen',display_name:'Stolen'});assert.ok(invalid.error)
 })
 const room={id:'cloud-room',code:'ES-CLOUD',name:'Cloud Room',private:true,createdBy:ids.a,members:[ids.a],roles:{[ids.a]:'admin'},trackIds:tracks.map(t=>t.id)}
 await check('private room joins require a valid code and listeners cannot forge FORCE_RESYNC or ROLE_UPDATE',async()=>{
 await A.publish({type:'room-added',room,sender:'a'},library)
 assert.equal((await B.rooms()).length,0)
 await assert.rejects(B.join(room.id,'wrong'));await assert.rejects(B.join(room.id,null))
 await B.join(room.id,room.code)
 await assert.rejects(B.publish({type:'FORCE_RESYNC',roomId:room.id,userId:ids.a,time:20,ts:Date.now(),index:0}))
 await assert.rejects(B.publish({type:'ROLE_UPDATE',roomId:room.id,roles:{[ids.b]:'admin'}}))
 await assert.rejects(C.publish({type:'room-deleted',roomId:room.id}))
 })
 const errors=[],receivedA=[],receivedB=[]
 const ta=createRealtimeTransport({Broadcast:null,configured:true,getClient:async()=>a,getContext:()=>({library}),onError:e=>errors.push(e.message)})
 const tb=createRealtimeTransport({Broadcast:null,configured:true,getClient:async()=>b,getContext:()=>({library}),onError:e=>errors.push(e.message)})
 ta.onmessage=e=>receivedA.push(e.data);tb.onmessage=e=>receivedB.push(e.data)
 const until=async fn=>{const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('contract condition timed out');await new Promise(r=>setTimeout(r,5))}}
 await ta.setContext({roomId:room.id,roomCode:room.code,userId:ids.a});await tb.setContext({roomId:room.id,roomCode:room.code,userId:ids.b});await until(()=>[...subscriptions].filter(s=>s.active&&s.topic==='echosync:room:'+room.id).length===2)
 await check('global presence aggregates topics and stops tracking when sharing is disabled; client broadcasts are denied',async()=>{
 await until(()=>receivedA.some(e=>e.type==='cloud-presence'&&e.people.some(p=>p.userId===ids.a)&&e.people.some(p=>p.userId===ids.b)))
 await tb.setContext({sharing:false})
 await until(()=>{const p=receivedA.filter(e=>e.type==='cloud-presence').at(-1);return p&&!p.people.some(p=>p.userId===ids.b)})
 await tb.setContext({sharing:true})
 await assert.rejects(run(ids.b,async()=>{await db.query("select set_config('realtime.topic',$1,false)",['echosync:lounge']);await db.query("insert into realtime.messages values('broadcast','echosync:lounge')")}))
 })
 await check('two remote clients without BroadcastChannel route CLOCK_SYNC, FORCE_RESYNC, votes and telemetry with server identities',async()=>{
 ta.postMessage({type:'CLOCK_SYNC',roomId:room.id,trackId:'one',time:12,ts:Date.now(),index:0,isPlaying:true,sender:'a'});await ta.flush();await until(()=>receivedB.some(e=>e.type==='state'&&e.time===12))
 ta.postMessage({type:'FORCE_RESYNC',roomId:room.id,time:14,ts:Date.now(),index:0,isPlaying:true,sender:'a'});await ta.flush();await until(()=>receivedB.some(e=>e.type==='FORCE_RESYNC'))
 tb.postMessage({type:'QUEUE_VOTE',roomId:room.id,userId:ids.a,trackId:'three',change:{active:true,ts:Date.now(),op:'b'},sender:'b'});await tb.flush();await until(()=>receivedA.some(e=>e.type==='room-vote'&&e.userId===ids.b))
 tb.postMessage({type:'MEMBER_TELEMETRY',roomId:room.id,userId:ids.a,seconds:1.2,sender:'b'});await tb.flush();await until(()=>receivedA.some(e=>e.type==='member-telemetry'&&e.userId===ids.b))
 const stored=(await A.rooms())[0];assert.equal(stored.queue[1].id,'three');assert.ok(stored.playback_clock.ts)
 })
 await check('global lounge song/text messages, reactions, ownership deletion and room histories persist and cross devices',async()=>{
 ta.postMessage({type:'lounge-message',sender:'a',message:{id:'song',type:'song',track:tracks[0],text:'One',author:ids.c}});await ta.flush();await until(()=>receivedB.some(e=>e.message?.id==='song'))
 const song=receivedB.find(e=>e.message?.id==='song').message;assert.equal(song.author,ids.a);assert.equal(song.track.id,'one')
 tb.postMessage({type:'lounge-reaction',sender:'b',messageId:'song',emoji:'❤️',active:true});await tb.flush();await until(()=>receivedA.some(e=>e.message?.reactions?.some(r=>r.userIds?.includes(ids.b))))
 await assert.rejects(B.publish({type:'lounge-delete',messageId:'song'}))
 ta.postMessage({type:'CHAT_MESSAGE',roomId:room.id,sender:'a',message:{id:'chat',type:'text',text:'Hello remote'}});await ta.flush();await until(()=>receivedB.some(e=>e.message?.id==='chat'))
 assert.equal((await C.history()).some(m=>m.id==='chat'),false)
 })
 await check('real recording blob uploads to owner path; only HTTPS URLs are broadcast; failures publish nothing',async()=>{
 const url=await A.uploadVoice(audioFixture,ids.a);assert.match(url,/^https:\/\/cloud.test/);assert.equal(files.size,1)
 ta.postMessage({type:'VOICE_NOTE',roomId:room.id,sender:'a',message:{id:'voice',type:'voice',voiceData:url,duration:2,text:''}});await ta.flush();await until(()=>receivedB.some(e=>e.message?.id==='voice'))
 assert.equal(receivedB.find(e=>e.message?.id==='voice').message.voiceData,url);assert.ok(!(await B.history()).some(m=>String(m.voice_url).startsWith('data:')))
 a.failedUpload=true;await assert.rejects(A.uploadVoice(audioFixture,ids.a));assert.equal(files.size,1);a.failedUpload=false
 await assert.rejects(A.uploadVoice('data:audio/wav;base64,',ids.a))
 })
 await check('room membership removal does not expose future private events to cached room subscriptions',async()=>{
 const row=(await A.rooms())[0];const next={...room,members:[ids.a],roles:{[ids.a]:'admin'},trackIds:row.queue.map(t=>t.id)}
 await A.publish({type:'room-updated',room:next,sender:'a'},library)
 const before=receivedB.filter(e=>e.type==='FORCE_RESYNC').length
 await A.publish({type:'FORCE_RESYNC',roomId:room.id,time:40,index:0,ts:Date.now(),sender:'a'})
 await new Promise(r=>setTimeout(r,10));assert.equal(receivedB.filter(e=>e.type==='FORCE_RESYNC').length,before)
 assert.equal((await B.history()).some(m=>m.id==='voice'),false)
 })
 await check('owner profile/playlist changes persist across another device and honor visibility changes',async()=>{
 const owned=await A.loadOwn(ids.a)
 const playlists=owned.playlists.map(p=>({...p,trackIds:p.tracks.map(t=>t.id),visibility:'public'}))
 await A.saveLibrary(ids.a,{likes:tracks.slice(0,2),taste:owned.profile.taste_profile,privacy:{showActivity:false},activity:{recent:['two']},playlists,library})
 const another=createCloudAdapter(client(ids.a)),loaded=await another.loadOwn(ids.a)
 assert.equal(loaded.profile.liked_tracks.length,2);assert.equal(loaded.profile.privacy_settings.local_migrated,true);assert.equal(loaded.playlists.length,2)
 assert.equal((await B.playlists()).filter(p=>p.owner_id===ids.a).length,2)
 const publicProfile=(await B.directory()).find(p=>p.id===ids.a);assert.deepEqual(publicProfile.taste_profile,{});assert.deepEqual(publicProfile.activity_status,{})
 })
 await check('owner library RPC rolls back profile changes if any playlist belongs to another user',async()=>{
 await B.saveLibrary(ids.b,{likes:[],taste:{},privacy:{},activity:{},playlists:[{id:'b-owned',name:'B library',trackIds:['one']}],library})
 const before=(await A.loadOwn(ids.a)).profile.liked_tracks
 await assert.rejects(A.saveLibrary(ids.a,{likes:tracks,taste:{},privacy:{},activity:{},playlists:[{id:'b-owned',name:'stolen',trackIds:['one']}],library}))
 assert.deepEqual((await A.loadOwn(ids.a)).profile.liked_tracks,before)
 })
 await check('24-hour cleanup helper is service-only and selects expired objects without SQL-deleting file metadata',async()=>{
 await assert.rejects(run(ids.a,()=>db.query('select * from public.echosync_expired_voice_notes()')))
 await serial;await db.exec('reset role');await db.exec("update storage.objects set created_at=now()-interval '25 hours';set role service_role")
 const expired=await db.query('select * from public.echosync_expired_voice_notes()');assert.equal(expired.rows.length,1)
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,1)
 const cleanup=fs.readFileSync('supabase/functions/cleanup-voice-notes/index.ts','utf8');assert.match(cleanup,/\.remove\(paths\)/);assert.doesNotMatch(cleanup,/delete from storage.objects/i)
 })
 ta.close();tb.close();await serial
 await check('cleanup Edge authorization requires its dedicated secret when configured and preserves legacy fallback',async()=>{
 const vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');let handler,calls=0;const env={SUPABASE_URL:'https://cloud.test',SUPABASE_SERVICE_ROLE_KEY:'server-key',ECHOSYNC_CLEANUP_SECRET:'cleanup-secret'};
 const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/cleanup-voice-notes/index.ts','utf8').replace(/^import[^\n]*\n/,''));
 vm.runInNewContext(source,{Deno:{env:{get:key=>env[key]},serve:fn=>handler=fn},Response,createClient:()=>({rpc:async()=>{calls++;return{data:[],error:null}}})});
 const request=headers=>new Request('https://cloud.test/functions/v1/cleanup-voice-notes',{method:'POST',headers});
 assert.equal((await handler(request({}))).status,401);
 assert.equal((await handler(request({authorization:'Bearer server-key'}))).status,401);
 assert.equal((await handler(request({'x-echosync-cleanup-secret':'wrong'}))).status,401);assert.equal(calls,0);
 assert.equal((await handler(request({'x-echosync-cleanup-secret':'cleanup-secret'}))).status,200);assert.equal(calls,1);
 delete env.ECHOSYNC_CLEANUP_SECRET;
 assert.equal((await handler(request({authorization:'Bearer server-key'}))).status,200);
 assert.equal((await handler(request({authorization:'Bearer wrong'}))).status,401);
 })
 await check('unconfigured transport is inert without BroadcastChannel and never loads the SDK',async()=>{
 assert.equal(isSupabaseConfigured(),false);let calls=0;const local=createRealtimeTransport({configured:false,Broadcast:null,getClient:()=>{calls++;throw Error('must not load')}});local.postMessage({type:'state'});await local.flush();local.close();assert.equal(calls,0)
 })
 assert.deepEqual(errors,[])
 await db.close();console.log(`Phase 3 cloud contracts: ${passed} checks passed (embedded PostgreSQL + two simulated remote clients; no live Supabase claim)`)
})().catch(error=>{console.error(error);process.exitCode=1})
