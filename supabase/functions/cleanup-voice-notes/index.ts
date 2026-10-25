import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
Deno.serve(async request => {
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 if(!key || request.headers.get('authorization')!==`Bearer ${key}`)return new Response('Unauthorized',{status:401})
 const client=createClient(Deno.env.get('SUPABASE_URL')!,key,{auth:{persistSession:false}})
 const {data,error}=await client.rpc('echosync_expired_voice_notes')
 if(error)return Response.json({error:error.message},{status:500})
 const paths=(data||[]).map((row:{name:string})=>row.name)
 if(paths.length){
  const removed=await client.storage.from('voice-notes').remove(paths)
  if(removed.error)return Response.json({error:removed.error.message},{status:500})
  for(const path of paths){
   const url=client.storage.from('voice-notes').getPublicUrl(path).data.publicUrl
   const updated=await client.from('messages').update({kind:'text',text:'Voice note expired after 24 hours',voice_url:null}).eq('voice_url',url)
   if(updated.error)return Response.json({error:updated.error.message},{status:500})
  }
 }
 return Response.json({removed:paths.length})
})
