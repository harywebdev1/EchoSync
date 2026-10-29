// Clean pathname routing shared by the app shell and the profile pages.
// These helpers are deliberately DOM-free so they can be unit tested in Node.

export const ROUTE_KEY = '__echoRoute'

export function artistSlug(value = '') {
  const raw = String(value || '')
  const ascii = typeof raw.normalize === 'function' ? raw.normalize('NFKD') : raw
  return ascii
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artist'
}

export function normalizeHandle(value = '') {
  return String(value || '').replace(/^@+/, '').trim().toLowerCase()
}

export function slugToArtistName(slug = '') {
  return String(slug || '')
    .replace(/-+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim()
}

export function parseRoute(pathname = '/', search = '') {
  const clean = `/${String(pathname || '/').split('?')[0].replace(/^\/+|\/+$/g, '')}`
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))

  if (clean === '/rooms') return { view: 'rooms', path: '/rooms' }
  if (clean === '/library') return { view: 'library', path: '/library' }

  const room = clean.match(/^\/room\/([^/]+)$/)
  if (room) {
    const code = decodeURIComponent(room[1])
    return { view: 'room', path: `/room/${room[1]}`, code }
  }

  const artist = clean.match(/^\/artist\/([^/]+)$/)
  if (artist) {
    const slug = decodeURIComponent(artist[1])
    return {
      view: 'artist',
      path: `/artist/${artist[1]}`,
      artist: {
        slug,
        name: slugToArtistName(slug),
        browseId: String(params.get('id') || '').trim(),
      },
    }
  }

  const user = clean.match(/^\/@([^/]+)$/)
  if (user) {
    const handle = normalizeHandle(decodeURIComponent(user[1]))
    return {
      view: 'user',
      path: `/@${encodeURIComponent(handle)}`,
      user: { handle },
    }
  }

  if (clean === '/') return { view: 'home', path: '/' }

  return { view: 'home', path: '/', notFound: true }
}

export function artistPath(nameOrProfile = '', browseId = '') {
  const name = typeof nameOrProfile === 'string'
    ? nameOrProfile
    : nameOrProfile?.name || nameOrProfile?.slug || ''
  const id = typeof nameOrProfile === 'object'
    ? String(nameOrProfile?.browseId || browseId || '')
    : String(browseId || '')
  const slug = typeof nameOrProfile === 'object' && nameOrProfile?.slug
    ? nameOrProfile.slug
    : artistSlug(name || id)
  return `/artist/${encodeURIComponent(slug)}${id ? `?id=${encodeURIComponent(id)}` : ''}`
}

export function userPath(value = '') {
  const handle = normalizeHandle(typeof value === 'string' ? value : value?.handle)
  return `/@${encodeURIComponent(handle)}`
}
