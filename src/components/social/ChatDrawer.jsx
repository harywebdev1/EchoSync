import { SongDrop } from './SongDrop.jsx'
import { conversationEntries } from '../../core/chatEvents.js'
import { useSocial } from './SocialContext.jsx'
import { useEffect, useRef, useState } from 'react'
import {
  MoreHorizontal,
  Mic,
  MicOff,
  MessageCircle,
  X,
  Send,
  Smile,
  Lock,
  Globe2,
  Sparkles,
  Check,
  CheckCheck,
  Wifi,
  Trash2,
  ShieldCheck,
  AtSign,
  CornerUpLeft,
  Music,
} from 'lucide-react'
import { LYRIC_EMOJIS, REACTION_EMOJIS } from '../../lib/chat'
import { formatTime } from '../../lib/time'
import { blobToDataUrl, makeVoiceWaveform, isUsableVoiceBlob } from '../../lib/voice'
import { useMembers } from '../shared/MembersContext'
import { AvatarStack } from '../shared/AvatarStack'
import { ROLE_COPY } from '../shared/roomRoles'
import { Avatar } from '../Avatar'
import { MessageText } from '../MessageText'
import { VoiceNoteBubble } from '../VoiceNoteBubble'
import { LyricsPanel } from '../player/LyricsPanel'

function VoiceRow({
  micOn,
  micLevel,
  speaking,
  duckTest,
  ducked,
  onToggleMic,
  onDuckTest,
  duckLevel = 20,
}) {
  const bars = [0.35, 0.7, 1, 0.55, 0.82, 0.42, 0.65]
  return (
    <div className="voice-row">
      <button className={`voice-btn ${micOn ? 'on' : ''}`} onClick={onToggleMic}>
        {micOn ? <Mic /> : <MicOff />}
        <span>{micOn ? 'Mic live' : 'Join voice'}</span>
        {micOn && <i className="voice-live-dot" />}
      </button>
      {speaking && (
        <span className="duck-indicator on">
          <span className="mic-bars">
            {bars.map((height, index) => (
              <i
                key={index}
                style={{ height: `${Math.max(3, height * (micLevel || 0.3) * 11)}px` }}
              />
            ))}
          </span>
          {ducked ? `Music ducked to ${duckLevel}%` : 'Voice detected'}
        </span>
      )}
      <span className="voice-note"><Lock size={8} /> Private room · live voice</span>
    </div>
  )
}

export function ChatDrawer({
  room,
  activeTab,
  onTab,
  messages,
  typingMemberId,
  draft,
  onDraft,
  onSend,
  onSendVoice,
  onVoiceNotePlay,
  onReact,
  onClose,
  track,
  lyrics,
  canControl,
  onSeek,
  onLock,
  onRetryLyrics,
  onDeleteMessage,
  onReply,
  replyTo,
  onCancelReply,
  open,
  currentUser,
  canModerate,
  memberRoles,
  translateOn,
  translating,
  onToggleTranslate,
  micOn,
  micLevel,
  speaking,
  duckTest,
  onToggleMic,
  onDuckTest,
  duckLevel,
  onOpenLounge,
  unreadLoungeCount = 0,
}) {
  const members = useMembers()
  const social = useSocial()
  const chatRef = useRef(null)
  const inputRef = useRef(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  useEffect(() => {
    if (!menuFor) return
    const frame = requestAnimationFrame(() => document.querySelector('.msg-actions.menu-open')?.scrollIntoView({ block: 'nearest' }))
    const dismiss = event => { if (!event.target.closest('.msg-actions')) setMenuFor(null) }
    const escape = event => { if (event.key === 'Escape') setMenuFor(null) }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [menuFor])
  const [mention, setMention] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordHint, setRecordHint] = useState('')
  const [voicePlayingId, setVoicePlayingId] = useState(null)
  const highlightTimer = useRef(null)
  const recorderRef = useRef(null)
  const recordStreamRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordAttemptRef = useRef(0)
  const recordStartedAtRef = useRef(0)
  const recordCancelledRef = useRef(false)
  const finishingRef = useRef(false)
  const recordFailedRef = useRef(false)
  const typingMember = typingMemberId ? members[typingMemberId] : null
  const mentionMatches = mention
    ? room.members
      .map((id) => members[id])
      .filter(Boolean)
      .filter((member) => {
        const query = mention.query.toLowerCase()
        if (!query) return true
        return member.handle?.toLowerCase().includes(query) || member.name?.toLowerCase().includes(query)
      })
      .slice(0, 6)
    : []

  useEffect(() => {
    if (activeTab !== 'chat') return
    const node = chatRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages.length, typingMemberId, activeTab, room.id])

  useEffect(() => {
    setEmojiOpen(false)
    setMenuFor(null)
    setMention(null)
    setHighlightId(null)
  }, [room.id])

  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  useEffect(() => {
    onVoiceNotePlay(Boolean(voicePlayingId))
  }, [voicePlayingId, onVoiceNotePlay])

  useEffect(() => {
    return () => {
      recordCancelledRef.current = true
      clearInterval(recordTimerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* already stopped */ }
      }
      recordStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      onVoiceNotePlay(false)
    }
  }, [onVoiceNotePlay])

  useEffect(() => {
    setVoicePlayingId(null)
    if (recordStartedAtRef.current) {
      recordCancelledRef.current = true
      clearInterval(recordTimerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* already stopped */ }
      }
      recordStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      recordStreamRef.current = null
      recorderRef.current = null
      recordChunksRef.current = []
      recordStartedAtRef.current = 0
      finishingRef.current = false
      setRecording(false)
      setRecordSeconds(0)
      setRecordHint('')
    }
  }, [room.id])

  const stopRecordingHardware = () => {
    clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* already stopped */ }
    }
    recorderRef.current = null
    recordStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    recordStreamRef.current = null
    recordChunksRef.current = []
  }

  const resetRecording = () => {
    recordAttemptRef.current += 1
    stopRecordingHardware()
    recordStartedAtRef.current = 0
    recordCancelledRef.current = false
    finishingRef.current = false
    recordFailedRef.current = false
    setRecording(false)
    setRecordSeconds(0)
    setRecordHint('')
  }

  const cancelRecording = () => {
    if (!recordStartedAtRef.current && !recording) return
    recordCancelledRef.current = true
    resetRecording()
  }

  const failRecording = (reason) => {
    resetRecording()
    recordCancelledRef.current = true
    recordFailedRef.current = true
    setRecordHint(typeof reason==='string'?reason:'Microphone access blocked or no audio captured — voice note was not sent.')
  }

  const startRecording = async () => {
    if (recording || finishingRef.current || recordStartedAtRef.current) return
    finishingRef.current = false
    recordCancelledRef.current = false
    recordFailedRef.current = false
    recordChunksRef.current = []
    const recordingId = ++recordAttemptRef.current
    recordStartedAtRef.current = Date.now()
    setRecording(true)
    setRecordSeconds(0)
    setRecordHint('')
    recordTimerRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - recordStartedAtRef.current) / 1000)
      setRecordSeconds(seconds)
      if (seconds >= 45) finishRecording(false)
    }, 250)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder unavailable')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (recordCancelledRef.current || finishingRef.current || recordAttemptRef.current !== recordingId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      recordStreamRef.current = stream
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined)
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        if (recordAttemptRef.current === recordingId) failRecording()
      }
      recorderRef.current = recorder
      recorder.start(250)
    } catch {
      if (recordAttemptRef.current !== recordingId || finishingRef.current) return
      failRecording()
    }
  }

  const finishRecording = async (discard = false) => {
    if (!recordStartedAtRef.current || finishingRef.current) return
    finishingRef.current = true
    const recordingId = recordAttemptRef.current
    clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
    const duration = Math.max(1, Math.min(45, (Date.now() - recordStartedAtRef.current) / 1000))
    const recorder = recorderRef.current
    if (discard) {
      recordCancelledRef.current = true
      resetRecording()
      return
    }
    setRecordHint('Sending voice note…')
    let dataUrl = ''
    try {
      if (recorder && recorder.state !== 'inactive' && !recordFailedRef.current) {
        dataUrl = await new Promise((resolve) => {
          let settled = false
          const complete = async () => {
            if (settled) return
            settled = true
            try {
              const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
              resolve(await isUsableVoiceBlob(blob) ? await blobToDataUrl(blob) : '')
            } catch {
              resolve('')
            }
          }
          recorder.onstop = complete
          try { recorder.stop() } catch { complete() }
          setTimeout(complete, 1500)
        })
      }
    } catch {
      dataUrl = ''
    }
    if (recordAttemptRef.current !== recordingId || recordCancelledRef.current) return
    if (!dataUrl || recordFailedRef.current) {
      failRecording()
      return
    }
    stopRecordingHardware()
    const sentDuration = duration
    const seed = `${room.id}-${Date.now()}-${dataUrl.length}`
    try { await onSendVoice?.({
      dataUrl,
      duration: Number(sentDuration.toFixed(1)),
      waveform: makeVoiceWaveform(seed),
    }) } catch { failRecording('Voice note upload failed — nothing was sent. Retry.'); return }
    recordStartedAtRef.current = 0
    recordCancelledRef.current = false
    finishingRef.current = false
    recordFailedRef.current = false
    setRecording(false)
    setRecordSeconds(0)
    setRecordHint('')
  }

  const handleDraftChange = (event) => {
    const value = event.target.value
    const cursor = event.target.selectionStart || value.length
    onDraft(value)
    const beforeCursor = value.slice(0, cursor)
    const match = beforeCursor.match(/(?:^|\s)@([\w.]{0,24})$/)
    if (match) setMention({ query: match[1], start: beforeCursor.length - match[1].length - 1 })
    else setMention(null)
  }

  const insertMention = (member) => {
    const start = mention ? mention.start : draft.length
    const end = mention ? mention.start + mention.query.length + 1 : draft.length
    const next = `${draft.slice(0, start)}@${member.handle} ${draft.slice(end)}`
    onDraft(next)
    setMention(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const scrollToMessage = (id) => {
    const node = chatRef.current?.querySelector(`[data-msg-id="${id}"]`)
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1800)
  }

  const submitMessage = () => {
    setMention(null)
    setEmojiOpen(false)
    onSend()
  }

  const roleOf = (userId) => memberRoles?.[userId] || (userId === room.dj ? 'dj' : 'listener')
  const currentLabel = currentUser?.handle || 'guest'

  return (
    <aside className={`social ${open ? 'mobile-open' : ''}`}>
      <div className="social-top">
        <div className="social-tabs">
          <button className={`social-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => onTab('chat')}>
            <MessageCircle /> Room chat
          </button>
          <button
            className="social-tab social-tab-lounge"
            onClick={onOpenLounge}
            data-testid="lounge-tab-btn"
          >
            <Globe2 /> Public Lounge
            {unreadLoungeCount > 0 && (
              <b className="social-tab-badge" data-testid="lounge-tab-unread">
                {unreadLoungeCount > 99 ? '99+' : unreadLoungeCount}
              </b>
            )}
          </button>
          <button className={`social-tab ${activeTab === 'lyrics' ? 'active' : ''}`} onClick={() => onTab('lyrics')}>
            <Sparkles /> Lyrics
          </button>
        </div>
        <button className="icon-btn social-close" onClick={onClose} aria-label="Close panel">
          <X />
        </button>
      </div>

      <div className="social-head">
        <div className="social-head-copy">
          <h3>{activeTab === 'chat' ? 'Room chat' : 'Live lyrics'}</h3>
          <p>
            {activeTab === 'chat' ? (
              <><Wifi /> Connected to the room</>
            ) : lyrics?.status === 'ready' && lyrics.type === 'plain' ? (
              <>Read along</>
            ) : (
              <>Synced with playback</>
            )}
          </p>
        </div>
        {activeTab === 'chat' ? (
          <AvatarStack ids={room.members} size="xs" max={3} />
        ) : (
          <span className="sync-chip"><Wifi /> <b>live</b></span>
        )}
      </div>

      {activeTab === 'chat' && room.private && (
        <div className="chat-live-mic" data-testid="chat-live-mic">
          <VoiceRow
            micOn={micOn}
            micLevel={micLevel}
            speaking={speaking}
            duckTest={duckTest}
            ducked={speaking}
            duckLevel={duckLevel}
            onToggleMic={onToggleMic}
            onDuckTest={onDuckTest}
          />
        </div>
      )}

      {activeTab === 'chat' ? (
        <>
          <div className="chat-body" ref={chatRef}>
            <div className="chat-day"><span>Today · {room.name}</span></div>
            {conversationEntries(messages).map((message) => {
              if (message.system) {
                return (
                    <div className="msg-system" key={message.id}>
                    <ShieldCheck />
                      {message.notices.length > 1 ? <details><summary>{message.notices.length} room updates</summary>{message.notices.map(notice => <p key={notice.id}><MessageText text={notice.text} members={members} currentUserId={currentUser?.id} onTag={insertMention} /></p>)}</details> : <span><MessageText text={message.text} members={members} currentUserId={currentUser?.id} onTag={insertMention} /></span>}
                  </div>
                )
              }
              const author = members[message.author] || members.me || { name: 'Listener', handle: 'listener' }
              const mine = message.author === currentUser?.id
              const canDelete = mine || canModerate
              return (
                <div
                  className={`msg-row ${mine ? 'mine' : ''} ${highlightId === message.id ? 'highlight' : ''}`}
                  key={message.id}
                  data-msg-id={message.id}
                >
                  {!mine && <button className="lounge-avatar-btn" onClick={()=>social.openProfile(author.id)} aria-label={`Open ${author.name}'s profile`}><Avatar member={author} size="sm" /></button>}
                  <div className="msg-main">
                    {!mine && (
                      <div className="msg-author">
                        <button className="lounge-author-btn" onClick={()=>social.openProfile(author.id)}>{author.name}</button>
                        <span className="msg-handle">@{author.handle}</span>
                        {roleOf(message.author) === 'dj' && <span className="dj-tag">DJ</span>}
                      </div>
                    )}
                    <div className={`bubble ${message.type === 'voice' ? 'voice' : ''}`}>
                      {message.replyTo && (
                        <button className="reply-quote" onClick={() => scrollToMessage(message.replyTo.id)}>
                          <strong>{message.replyTo.name || message.replyTo.handle}</strong>
                          <span>{message.replyTo.text || 'Voice note'}</span>
                        </button>
                      )}
                      {message.type === 'song' && message.track ? <SongDrop track={message.track}/> : message.type === 'voice' && message.voiceData ? (
                        <VoiceNoteBubble
                          message={message}
                          isActive={voicePlayingId === message.id}
                          onActivate={() => setVoicePlayingId(message.id)}
                          onDeactivate={() => setVoicePlayingId((current) => (current === message.id ? null : current))}
                        />
                      ) : (
                        <MessageText text={message.text} members={members} currentUserId={currentUser?.id} onTag={insertMention} />
                      )}
                      <span className="bubble-meta">
                        {message.time}
                        {mine && (message.read ? <CheckCheck /> : <Check />)}
                      </span>
                      <div className={`msg-actions ${menuFor === message.id ? 'menu-open' : ''}`}>
                        <button className="msg-action" onClick={() => onReply(message)} aria-label="Reply to message">
                          <CornerUpLeft />
                        </button>
                        <button
                          className="msg-action"
                          onClick={() => setMenuFor((value) => (value === message.id ? null : message.id))}
                          aria-label="Message options"
                        >
                          <MoreHorizontal />
                        </button>
                        {menuFor === message.id && (
                          <div className="msg-menu">
                            <button onClick={() => { onReply(message); setMenuFor(null) }}><CornerUpLeft /> Reply</button>
                            <button onClick={() => { insertMention(author); setMenuFor(null) }}><AtSign /> Tag @{author.handle}</button>
                            <div className="msg-menu-emojis">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button key={emoji} onClick={() => { onReact(message.id, emoji); setMenuFor(null) }}>{emoji}</button>
                              ))}
                            </div>
                            {canDelete && (
                              <button className="danger" onClick={() => { onDeleteMessage(message.id); setMenuFor(null) }}>
                                <Trash2 /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {message.reactions?.length > 0 && (
                      <div className="msg-reactions">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            className={`reaction ${reaction.mine ? 'mine' : ''}`}
                            onClick={() => onReact(message.id, reaction.emoji)}
                          >
                            {reaction.emoji} <b>{reaction.count}</b>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {typingMember && (
              <div className="typing-row">
                <Avatar member={typingMember} size="sm" />
                <div>
                  <div className="typing-bubble"><i /><i /><i /></div>
                  <span className="typing-label">{typingMember.name.split(' ')[0]} is typing</span>
                </div>
              </div>
            )}
          </div>

          <div className="chat-composer">
            {!recording && recordHint && (
              <div className="recording-error" role="alert">
                <span>{recordHint}</span>
                <button type="button" onClick={startRecording}>Retry</button>
              </div>
            )}
            {replyTo && (
              <div className="reply-bar">
                <span className="reply-bar-accent" />
                <div>
                  <strong>{replyTo.name} <span>@{replyTo.handle}</span></strong>
                  <p>{replyTo.text}</p>
                </div>
                <button className="icon-btn" onClick={onCancelReply} aria-label="Cancel reply"><X /></button>
              </div>
            )}
            {mention && mentionMatches.length > 0 && (
              <div className="mention-pop">
                <div className="mention-pop-label">Tag a member of {room.name}</div>
                {mentionMatches.map((member) => (
                  <button key={member.id} className="mention-option" onClick={() => insertMention(member)}>
                    <Avatar member={member} size="sm" />
                    <span>
                      <strong>{member.name}</strong>
                      <small>@{member.handle}</small>
                    </span>
                    <em>{ROLE_COPY[roleOf(member.id)]?.label || 'Listener'}</em>
                  </button>
                ))}
              </div>
            )}
            {recording ? (
              <div className="recording-console" data-testid="recording-bar">
                <span className="recording-dot" />
                <span className="recording-timer">{formatTime(recordSeconds)}</span>
                <div className="recording-wave" aria-hidden="true">
                  {[0.35, 0.68, 0.94, 0.52, 0.8, 0.42, 0.72, 0.58, 0.88, 0.46, 0.76, 0.62].map((height, index) => (
                    <i key={index} style={{ height: `${Math.max(3, height * 18)}px`, animationDelay: `${index * 0.08}s` }} />
                  ))}
                </div>
                <span className="recording-hint">{recordHint || 'Recording voice note…'}</span>
                <button className="record-cancel" onClick={cancelRecording}>Cancel</button>
                <button className="record-send" onClick={() => finishRecording(false)}>
                  <Send /> Send
                </button>
              </div>
            ) : (
              <>
                {emojiOpen && (
                  <div className="emoji-pop">
                    {LYRIC_EMOJIS.map((emoji) => (
                      <button key={emoji} onClick={() => onDraft(draft + emoji)}>{emoji}</button>
                    ))}
                  </div>
                )}
                <button className="emoji-btn" onClick={() => setEmojiOpen((value) => !value)} aria-label="Add emoji">
                  <Smile />
                </button>
                <button
                  className="emoji-btn"
                  onClick={() => {
                    const prefix = draft && !draft.endsWith(' ') ? ' ' : ''
                    const next = `${draft}${prefix}@`
                    onDraft(next)
                    setMention({ query: '', start: draft.length + prefix.length })
                    requestAnimationFrame(() => inputRef.current?.focus())
                  }}
                  aria-label="Mention a member"
                >
                  <AtSign />
                </button>
                <div className="composer-input">
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={(event) => {
                      if (mention && mentionMatches.length && event.key === 'Tab') {
                        event.preventDefault()
                        insertMention(mentionMatches[0])
                        return
                      }
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        submitMessage()
                      }
                    }}
                    placeholder={`Message the room as @${currentLabel}…`}
                    aria-label="Room message"
                  />
                  <button className="share-song-btn" aria-label="Share song" title="Share current song" onClick={()=>social.shareSong('room')}>♫</button>
                  <button className="voice-note-btn"
                    onClick={startRecording}
                    aria-label="Record voice note"
                    title="Record voice note"
                    data-testid="voice-note-btn"
                  >
                    <Mic />
                  </button>
                  <button className="send-btn" onClick={submitMessage} aria-label="Send message">
                    <Send />
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="social-note">
            <Lock size={9} /> {room.private ? 'Live mic is room-only · voice notes stay in chat' : 'Voice notes only · live mic is available in private rooms'}
          </div>
        </>
      ) : (
        <LyricsPanel
          track={track}
          lyrics={lyrics}
          canControl={canControl}
          onSeek={onSeek}
          onLock={onLock}
          onRetry={onRetryLyrics}
          translateOn={translateOn}
          translating={translating}
          onToggleTranslate={onToggleTranslate}
        />
      )}
    </aside>
  )
}
