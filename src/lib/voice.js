function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function synthVoiceWav(seconds = 3) {
  const sampleRate = 8000
  const duration = Math.max(0.8, Math.min(45, Number(seconds) || 3))
  const total = Math.floor(sampleRate * duration)
  const buffer = new ArrayBuffer(44 + total * 2)
  const view = new DataView(buffer)
  const write = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, total * 2, true)
  for (let index = 0; index < total; index += 1) {
    const t = index / sampleRate
    const envelope = Math.min(1, t * 7) * Math.min(1, (duration - t) * 5)
    const syllable = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.1 * t)
    const voice = Math.sin(2 * Math.PI * (180 + 40 * Math.sin(2 * Math.PI * 0.7 * t)) * t)
    const shimmer = 0.16 * Math.sin(2 * Math.PI * 720 * t)
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, (voice * syllable + shimmer) * envelope * 0.45)) * 0x7fff, true)
  }
  return `data:audio/wav;base64,${bufferToBase64(buffer)}`
}

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
