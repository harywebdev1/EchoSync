import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { formatTime } from '../lib/time'
import { makeVoiceWaveform } from '../lib/voice'

export function VoiceNoteBubble({ message, isActive, onActivate, onDeactivate }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const duration = Math.max(1, Number(message.duration) || 1)
  const waveform = Array.isArray(message.waveform) && message.waveform.length
    ? message.waveform
    : makeVoiceWaveform(message.id)
  const pct = Math.min(1, elapsed / duration)

  useEffect(() => {
    if (isActive) return
    const audio = audioRef.current
    if (audio && !audio.paused) {
      audio.pause()
      setPlaying(false)
    }
  }, [isActive])

  useEffect(() => () => {
    const audio = audioRef.current
    if (audio) audio.pause()
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      onDeactivate()
      return
    }
    onActivate()
    const playback = audio.play()
    playback?.then?.(() => setPlaying(true)).catch(() => {
      setPlaying(false)
      onDeactivate()
    })
  }

  return (
    <div className={`voice-note-bubble ${playing ? 'playing' : ''}`} data-testid="voice-note-bubble">
      <audio
        ref={audioRef}
        src={message.voiceData}
        preload="metadata"
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime || 0)}
        onEnded={() => {
          setPlaying(false)
          setElapsed(0)
          onDeactivate()
        }}
        onError={() => {
          setPlaying(false)
          onDeactivate()
        }}
      />
      <button className="voice-note-play" onClick={toggle} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>
        {playing ? <Pause /> : <Play />}
      </button>
      <div className="voice-note-wave" aria-hidden="true">
        {waveform.map((height, index) => (
          <i
            key={index}
            className={index / waveform.length <= pct ? 'played' : ''}
            style={{ height: `${Math.max(3, height * 22)}px` }}
          />
        ))}
      </div>
      <span className="voice-note-time">{formatTime(playing ? elapsed : duration)}</span>
    </div>
  )
}
