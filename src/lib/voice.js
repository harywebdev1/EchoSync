export function makeVoiceWaveform(seed = '', bars = 28) {
  const source = String(seed)
  let hash = 0
  for (let index = 0; index < source.length; index += 1) hash = (hash * 31 + source.charCodeAt(index)) % 100000
  return Array.from({ length: bars }, (_, index) => {
    const phase = Math.sin((hash + index * 37) * 0.017) * 0.5 + 0.5
    const wave = Math.sin((index + 1) * 0.83 + (hash % 17)) * 0.22
    return Math.min(1, Math.max(0.16, 0.3 + phase * 0.58 + wave))
  })
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read voice note'))
    reader.readAsDataURL(blob)
  })
}

export async function isUsableVoiceBlob(blob) {
  if (!blob || blob.size <= 120) return false
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return false
  const context = new AudioContextClass()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    return decoded.length > 0 && decoded.duration > 0
  } catch {
    return false
  } finally {
    await context.close().catch(() => {})
  }
}
