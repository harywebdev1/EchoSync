// Search results share the stream-cache payload. Translation preferences and
// the track library are deliberately excluded from this rebuildable-cache list.
const DISPOSABLE_CACHE_KEYS = new Set([
  'echosync_stream_cache_v4',
  'echosync.lyrics.v1',
  'echosync_lyrics_trans_cache',
])
const DISPOSABLE_CACHE_PREFIXES = ['echosync_daily_feed_v3_', 'echosync_daily_feed_']

export function isDisposableCacheKey(key) {
  return DISPOSABLE_CACHE_KEYS.has(key) || DISPOSABLE_CACHE_PREFIXES.some(prefix => key.startsWith(prefix))
}

/** Synchronous JSON persistence with an injected StorageLike backend.
 * getStorage is lazy so access/security failures are caught on every operation.
 * Native clients can supply a synchronous backend; asynchronous backends require
 * a separate adapter/migration rather than silently changing Web hydration.
 * getKeys can be supplied by backends whose keys are not enumerable properties.
 * onWriteFailure receives { key, error, attempts: 2 }; UI notification stays with the caller.
 */
export function createStorageAdapter({ getStorage, getKeys = storage => Object.keys(storage), onWriteFailure } = {}) {
  function read(key, fallback) {
    try {
      const raw = getStorage().getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  function write(key, value) {
    let error
    const attempt = () => {
      try {
        getStorage().setItem(key, JSON.stringify(value))
        return true
      } catch (failure) {
        error = failure
        return false
      }
    }
    if (attempt()) return true
    try {
      const storage = getStorage()
      getKeys(storage).forEach(cacheKey => {
        if (isDisposableCacheKey(cacheKey)) storage.removeItem(cacheKey)
      })
    } catch {
      // A backend may be completely unavailable. Still make the single retry.
    }
    if (attempt()) return true
    onWriteFailure?.({ key, error, attempts: 2 })
    return false
  }

  return { read, write }
}
