let pending
export function supabaseConfiguration() {
  const override = globalThis.__ECHOSYNC_SUPABASE__
  return override || { url: import.meta.env?.VITE_SUPABASE_URL || '', key: import.meta.env?.VITE_SUPABASE_ANON_KEY || '' }
}
export function isSupabaseConfigured() {
  const { url, key, client } = supabaseConfiguration()
  return Boolean(client || (url && key))
}
export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null
  const config = supabaseConfiguration()
  if (config.client) return config.client
  if (!pending) pending = import('@supabase/supabase-js').then(({createClient}) => createClient(config.url, config.key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})).catch(error=>{pending=null;throw error})
  return pending
}
export function isCloudVoiceUrl(value) {
  const {url}=supabaseConfiguration()
  if (!url || typeof value!=='string') return false
  try { const candidate=new URL(value), base=new URL(url); return candidate.protocol==='https:' && candidate.origin===base.origin && candidate.pathname.startsWith('/storage/v1/object/public/voice-notes/') } catch {return false}
}
