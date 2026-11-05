const clean = value => String(value || '').normalize('NFKD').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split('|')[0].replace(/\b(official|music|video|audio|lyrics|lyrical|hd|hq|song)\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function sameRecording(a, b) {
  const version = title => (String(title).split('|')[0].toLowerCase().match(/lo[ -]?fi|slowed|reverb|remix|acoustic|sped[ -]?up|jhankar|karaoke|cover|instrumental|mashup|medley/g)||[]).sort().join('|')
  if(version(a.title)!==version(b.title)) return false
  const names = track => String(track.artist || track.artists?.map(item => item.name).join(',') || '').split(/,|&| feat\.? | ft\.? /i).map(clean).filter(Boolean)
  const artists=names(a), peers=names(b)
  const fullTitle=String(b.title||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
  const credited=artists.some(name=>peers.includes(name)||(' '+fullTitle+' ').includes(' '+name+' '))
  if(!credited)return false
  const titleFor=track=>{let title=' '+clean(track.title).replace(/\bfull\b/g,'')+' ';for(const name of [...artists,...peers])title=title.replace(' '+name+' ',' ');return title.replace(/\s+/g,' ').trim()}
  const title=titleFor(a), other=titleFor(b)
  if(!title||!other)return false
  if(/\s[x×]\s/i.test(String(b.title).split('|')[0]))return false
  const durationA=Number(a.duration),durationB=Number(b.duration)
  if(durationA>0&&durationB>0&&Math.abs(durationA-durationB)>Math.max(45,durationA*.25))return false
  return title===other || other.startsWith(title+' ') || title.startsWith(other+' ')
}
export function alternateVideoIds(track, results = [], blocked = new Set()) {
  const matching = results.filter(candidate => sameRecording(track, candidate) && !/cover|karaoke|slowed|reverb|remix/i.test(candidate.title))
  return [...new Set([...(track.altVideoIds || []), ...matching.flatMap(candidate => [candidate.youtubeVideoId || candidate.videoId, ...(candidate.altVideoIds || [])])])].filter(id => /^[\w-]{11}$/.test(id || '') && !blocked.has(id)).slice(0, 3)
}
