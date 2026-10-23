import { findActiveLyricLine } from '../../core/lrcParser.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Music2, AlertCircle, RefreshCw, Globe } from 'lucide-react'
import { formatTime } from '../../lib/time'
import { usePlaybackProgress } from '../../state/playbackStore'
import { Cover } from '../Cover'

export function LyricsPanel({
  track,
  lyrics,
  canControl,
  onSeek,
  onLock,
  onRetry,
  showTrack = true,
  translateOn = false,
  translating = false,
  onToggleTranslate,
}) {
  const scrollRef = useRef(null)
  const pauseUntil = useRef(0)
  const resumeTimer = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [pausedHint, setPausedHint] = useState(false)
  const progress = usePlaybackProgress()
  const translateAvailable = lyrics?.status === 'ready'
    && lyrics.translatable !== false
    && lyrics.language !== 'en'
    && lyrics.language !== 'hi'
    && Boolean(lyrics.lines?.length)
  const languageLabel = lyrics?.status === 'ready'
    ? lyrics.language === 'hi'
      ? 'HINGLISH'
      : lyrics.language === 'ur'
        ? 'URDU'
        : lyrics.language === 'en'
          ? 'ENGLISH'
          : lyrics.language === 'other'
            ? 'TRANSLATED'
            : ''
    : ''

  const activeIndex = useMemo(() => {
    if (lyrics?.status !== 'ready' || lyrics.type !== 'synced' || !lyrics.lines?.length) return -1
    return findActiveLyricLine(lyrics.lines, progress)
  }, [lyrics, progress])

  useEffect(() => {
    if (!autoScroll || activeIndex < 0 || !scrollRef.current) return
    if (Date.now() < pauseUntil.current) return
    const container = scrollRef.current
    const line = container.querySelector(`[data-lyric-index="${activeIndex}"]`)
    if (!line) return
    const top = line.offsetTop - container.clientHeight * 0.32
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [activeIndex, autoScroll])

  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  const pauseAutoScroll = () => {
    if (!autoScroll) return
    pauseUntil.current = Date.now() + 6000
    setPausedHint(true)
    clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setPausedHint(false), 6000)
  }

  const seekLine = (line) => {
    if (!canControl) {
      onLock()
      return
    }
    onSeek(line.time)
  }

  return (
    <div className="lyrics-shell">
      {showTrack && (
        <div className="lyrics-track">
          <Cover track={track} size="cover-size-sm" />
          <div className="lyrics-track-copy">
            <strong>{track?.title || 'Nothing playing'}</strong>
            <span>{track?.artist || 'EchoSync'}</span>
          </div>
          <span className="source-badge">LRCLIB</span>
        </div>
      )}

      <div
        className="lyrics-body"
        ref={scrollRef}
        onWheel={pauseAutoScroll}
        onTouchMove={pauseAutoScroll}
      >
        {lyrics?.status === 'loading' && (
          <div className="lyrics-skeleton">
            <span /><span /><span /><span /><span /><span />
          </div>
        )}

        {lyrics?.status === 'error' && (
          <div className="lyrics-placeholder">
            <AlertCircle />
            <h4>No lyrics on this frequency</h4>
            <p>LRCLIB is taking a breath. The room keeps playing — try the lyrics again in a moment.</p>
            <button className="retry-btn" onClick={onRetry}><RefreshCw /> Try again</button>
          </div>
        )}

        {lyrics?.status === 'idle' && (
          <div className="lyrics-placeholder">
            <Music2 />
            <h4>Lyrics, when you want them</h4>
            <p>Play a track and the words will find their place here.</p>
          </div>
        )}

        {lyrics?.status === 'ready' && lyrics.type === 'plain' && (
          <div className="plain-lyrics">
            {(lyrics.lines || []).map((line, index) => {
              const translated = translateOn && line.enText && line.enText.toLowerCase() !== line.text.trim().toLowerCase()
                ? line.enText
                : null
              return (
                <div className={`plain-line ${translated ? 'translated' : ''}`} key={`${line.time}-${index}`}>
                  {translated ? (
                    <span className="lyric-dual">
                      <span className="lyric-en">{translated}</span>
                      <span className="lyric-orig">{line.sourceText || line.text}</span>
                    </span>
                  ) : line.text}
                </div>
              )
            })}
          </div>
        )}

        {lyrics?.status === 'ready' && lyrics.type === 'synced' && (
          <>
            {lyrics.lines.map((line, index) => {
              const translated = translateOn && line.enText && line.enText.toLowerCase() !== line.text.trim().toLowerCase()
                ? line.enText
                : null
              return (
                <button
                  key={`${line.time}-${index}`}
                  className={`lyric-line ${index === activeIndex ? 'active' : ''} ${translated ? 'translated' : ''}`}
                  data-lyric-index={index}
                  onClick={() => seekLine(line)}
                  title={translated ? (line.sourceText || line.text) : undefined}
                >
                  <span className="lyric-time">{formatTime(line.time)}</span>
                  {translated ? (
                    <span className="lyric-dual">
                      <span className="lyric-en">{translated}</span>
                      <span className="lyric-orig">{line.sourceText || line.text}</span>
                    </span>
                  ) : line.text}
                </button>
              )
            })}
            {lyrics.instrumental && (
              <div className="lyrics-placeholder" style={{ minHeight: 100 }}>
                <p>This one lets the instruments do the talking.</p>
              </div>
            )}
          </>
        )}

        {lyrics?.status === 'none' && (
          <div className="lyrics-placeholder">
            <Sparkles />
            <h4>No lyrics for this one</h4>
            <p>The room keeps moving. Some songs are better without words.</p>
          </div>
        )}
      </div>

      <div className="lyrics-foot">
        <span className="source-badge">LRCLIB</span>
        {languageLabel && <span className="source-badge lyric-language">{languageLabel}</span>}
        <span className="mono">
          {lyrics?.status === 'ready' && lyrics.type === 'synced'
            ? `${lyrics.lines.length} lines · synced`
            : lyrics?.status === 'ready' && lyrics.type === 'plain'
              ? `${lyrics.lines?.length || 0} lines · plain`
              : lyrics?.status === 'loading'
                ? 'finding words…'
                : lyrics?.status === 'error'
                  ? 'unavailable'
                  : 'time-synced lyrics'}
        </span>
        {translateAvailable && onToggleTranslate && (
          <button
            className={`translate-btn ${translateOn ? 'on' : ''}`}
            onClick={onToggleTranslate}
            disabled={translating}
          >
            {translating ? <span className="spinner" /> : <Globe />}
            {translating ? 'Translating lyrics to English…' : translateOn ? 'Showing English' : 'Translate to English'}
          </button>
        )}
        <button className={`auto-toggle ${autoScroll ? 'on' : ''}`} onClick={() => setAutoScroll((value) => !value)}>
          <Sparkles />
          {pausedHint && autoScroll ? 'Paused' : autoScroll ? 'Auto' : 'Manual'}
        </button>
      </div>
    </div>
  )
}
