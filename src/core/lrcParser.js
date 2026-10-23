const DEVANAGARI_VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ॐ': 'om',
}
const DEVANAGARI_MATRAS = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e',
  'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e',
}
const DEVANAGARI_CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l',
}
const DEVANAGARI_NUKTA = { 'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f' }
const DEVANAGARI_MARKS = { 'ं': 'n', 'ँ': 'n', 'ः': 'h', 'ऽ': '', '्': '' }

export function hasDevanagari(value = '') {
  return /[\u0900-\u097F]/.test(String(value))
}

export function transliterateDevanagari(value = '') {
  const text = String(value)
  let output = ''
  let pendingConsonant = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '्') {
      pendingConsonant = false
      continue
    }
    if (DEVANAGARI_CONSONANTS[char]) {
      if (pendingConsonant && !output.endsWith(' ')) output += 'a'
      if (text[index + 1] === '़' && DEVANAGARI_NUKTA[char]) {
        output += DEVANAGARI_NUKTA[char]
        index += 1
      } else {
        output += DEVANAGARI_CONSONANTS[char]
      }
      pendingConsonant = true
      continue
    }
    if (DEVANAGARI_MATRAS[char]) {
      output += DEVANAGARI_MATRAS[char]
      pendingConsonant = false
      continue
    }
    if (DEVANAGARI_VOWELS[char]) {
      output += DEVANAGARI_VOWELS[char]
      pendingConsonant = false
      continue
    }
    if (DEVANAGARI_MARKS[char] !== undefined) {
      output += DEVANAGARI_MARKS[char]
      pendingConsonant = false
      continue
    }
    if (char === '।') {
      output += '.'
      pendingConsonant = false
      continue
    }
    if (pendingConsonant && !/[\u0900-\u097F]/.test(char)) pendingConsonant = false
    output += char
  }
  return output
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}

export function detectLyricsLanguage(value = '') {
  const text = String(value)
  if (hasDevanagari(text)) return 'hi'
  if (/[\u0600-\u06FF]/.test(text)) return 'ur'
  if (/[\u0400-\u04FF]/.test(text)) return 'other'
  if (/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text)) return 'other'
  return 'en'
}

export function parseLrc(text) {
  if (!text) return []
  const lines = []
  text.split(/\r?\n/).forEach((rawLine) => {
    const stamps = [...rawLine.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) return
    const content = rawLine.replace(/\[[^\]]+\]/g, '').trim()
    if (!content) return
    stamps.forEach((stamp) => {
      const minutes = Number(stamp[1])
      const seconds = Number(stamp[2])
      const fraction = stamp[3] ? Number(stamp[3].padEnd(3, '0')) : 0
      lines.push({ time: minutes * 60 + seconds + fraction / 1000, text: content })
    })
  })
  return lines.sort((a, b) => a.time - b.time)
}

/** Sorted lines in seconds; retain the Web player's 120ms lookahead and first-line fallback. */
export function findActiveLyricLine(lines, positionSeconds, lookaheadSeconds = 0.12) {
  if (!lines?.length) return -1
  const target = positionSeconds + lookaheadSeconds
  let low = 0
  let high = lines.length - 1
  let active = -1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (lines[middle].time <= target) {
      active = middle
      low = middle + 1
    } else high = middle - 1
  }
  return active < 0 ? 0 : active
}
