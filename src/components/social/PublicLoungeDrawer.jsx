import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AtSign,
  CornerUpLeft,
  Globe2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Send,
  Smile,
  Sparkles,
  Trash2,
  UserPlus,
  Wifi,
  X,
} from 'lucide-react'
import { Avatar } from '../Avatar'
import { MessageText } from '../MessageText'
import { VoiceNoteBubble } from '../VoiceNoteBubble'
import { LOUNGE_REACTIONS, LYRIC_EMOJIS } from '../../lib/chat'
import { formatTime } from '../../lib/time'
import { blobToDataUrl, makeVoiceWaveform, isUsableVoiceBlob } from '../../lib/voice'

export function PublicLoungeDrawer({
  open,
  messages,
  currentUser,
  members,
  typingMember,
  room,
  inRoom,
  draft,
  onDraft,
  onSend,
  onSendVoice,
  onVoiceNotePlay,
  onReact,
  onDelete,
  onReply,
  replyTo,
  onCancelReply,
  onClose,
  onOpenRoomChat,
  onInviteUser,
  invitingId,
  onLogin,
  UserCard,
}) {
  const chatRef = useRef(null)
  const inputRef = useRef(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  const [cardFor, setCardFor] = useState(null)
  const [mention, setMention] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [voicePlayingId, setVoicePlayingId] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordHint, setRecordHint] = useState('')
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
  const memberList = useMemo(() => Object.values(members || {}).filter(Boolean), [members])
  const mentionMatches = mention
    ? memberList
      .filter((member) => {
        const query = mention.query.toLowerCase()
        if (!query) return true
        return member.handle?.toLowerCase().includes(query) || member.name?.toLowerCase().includes(query)
      })
      .slice(0, 6)
    : []

  useEffect(() => {
    if (!open) return
    const node = chatRef.current
    if (node) node.scrollTo({ top: node.scrollHeight })
  }, [open, messages.length, typingMember?.id])

  useEffect(() => {
    if (!open) return
    setMenuFor(null)
    setMention(null)
    setCardFor(null)
    setHighlightId(null)
  }, [open])

  useEffect(() => () => {
    clearTimeout(highlightTimer.current)
    recordCancelledRef.current = true
    clearInterval(recordTimerRef.current)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* already stopped */ }
    }
    recordStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    onVoiceNotePlay?.(false)
  }, [onVoiceNotePlay])

  useEffect(() => {
    onVoiceNotePlay?.(Boolean(voicePlayingId))
  }, [voicePlayingId, onVoiceNotePlay])

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

  const failRecording = () => {
    resetRecording()
    recordCancelledRef.current = true
    recordFailedRef.current = true
    setRecordHint('Microphone access blocked or no audio captured — voice note was not sent.')
  }

  const startRecording = async () => {
    if (!currentUser) {
      onLogin?.()
      return
    }
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
    const seed = `lounge-${Date.now()}-${dataUrl.length}`
    onSendVoice?.({
      dataUrl,
      duration: Number(sentDuration.toFixed(1)),
      waveform: makeVoiceWaveform(seed, 32),
    })
    recordStartedAtRef.current = 0
    recordCancelledRef.current = false
    finishingRef.current = false
    recordFailedRef.current = false
    setRecording(false)
    setRecordSeconds(0)
    setRecordHint('')
    setVoicePlayingId(null)
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
    if (!member) return
    const start = mention ? mention.start : draft.length
    const end = mention ? mention.start + mention.query.length + 1 : draft.length
    const next = `${draft.slice(0, start)}@${member.handle} ${draft.slice(end)}`
    onDraft(next)
    setMention(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const scrollToLoungeMessage = (id) => {
    const node = chatRef.current?.querySelector(`[data-lounge-id="${id}"]`)
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

  const cardMember = cardFor ? members[cardFor] : null
  const currentLabel = currentUser?.handle || 'guest'

  return (
    <aside className={`social lounge-drawer ${open ? 'mobile-open' : ''}`} data-testid="lounge-drawer">
      <div className="social-top">
        {inRoom ? (
          <div className="social-tabs">
            <button className="social-tab" onClick={() => onOpenRoomChat('chat')}>
              <MessageCircle /> Room chat
            </button>
            <button className="social-tab active" data-testid="lounge-active-tab">
              <Globe2 /> Public Lounge
            </button>
            <button className="social-tab" onClick={() => onOpenRoomChat('lyrics')}>
              <Sparkles /> Lyrics
            </button>
          </div>
        ) : (
          <div className="lounge-drawer-title">
            <Globe2 />
            <span>EchoSync</span>
          </div>
        )}
        <button className="icon-btn social-close" onClick={onClose} aria-label="Close lounge" data-testid="lounge-close-btn">
          <X />
        </button>
      </div>

      <div className="social-head lounge-head">
        <div className="social-head-copy">
          <h3>Public Lounge</h3>
          <p><span className="lounge-online-dot" /> Everyone here · live across tabs</p>
        </div>
        <span className="sync-chip"><Wifi /> <b>{messages.length}</b></span>
      </div>

      <div className="chat-body lounge-body" ref={chatRef}>
        <div className="chat-day"><span>EchoSync · Public Lounge</span></div>
        {!messages.length && (
          <div className="lounge-empty">
            <span><Globe2 /></span>
            <strong>The Lounge is quiet.</strong>
            <p>Say hello, share a voice note, or invite someone you met here into a private room.</p>
          </div>
        )}
        {messages.map((message) => {
          const author = members[message.author] || {
            id: message.author,
            name: message.userName || 'Listener',
            handle: message.authorHandle || 'listener',
          }
          const mine = message.author === currentUser?.id
          return (
            <div
              className={`msg-row lounge-msg ${mine ? 'mine' : ''} ${highlightId === message.id ? 'highlight' : ''}`}
              key={message.id}
              data-lounge-id={message.id}
              data-testid="lounge-message"
            >
              {!mine && (
                <button className="lounge-avatar-btn" onClick={() => setCardFor(author.id)} aria-label={`Open ${author.name}'s profile`}>
                  <Avatar member={author} size="sm" online={Boolean(author.online)} />
                </button>
              )}
              <div className="msg-main">
                {!mine && (
                  <div className="msg-author">
                    <button className="lounge-author-btn" onClick={() => setCardFor(author.id)}>{author.name}</button>
                    <span className="msg-handle">@{author.handle}</span>
                  </div>
                )}
                <div className={`bubble lounge-bubble ${message.type === 'voice' ? 'voice' : ''}`}>
                  {message.replyTo && (
                    <button className="reply-quote" onClick={() => scrollToLoungeMessage(message.replyTo.id)}>
                      <strong>{message.replyTo.name || message.replyTo.handle}</strong>
                      <span>{message.replyTo.text || 'Voice note'}</span>
                    </button>
                  )}
                  {message.type === 'voice' && message.voiceData ? (
                    <VoiceNoteBubble
                      message={message}
                      isActive={voicePlayingId === message.id}
                      onActivate={() => setVoicePlayingId(message.id)}
                      onDeactivate={() => setVoicePlayingId((current) => (current === message.id ? null : current))}
                    />
                  ) : (
                    <MessageText text={message.text} members={members} currentUserId={currentUser?.id} onTag={insertMention} />
                  )}
                  <span className="bubble-meta">{message.time}</span>
                  <div className="msg-actions">
                    <button className="msg-action" onClick={() => onReply(message, author)} aria-label="Reply in Public Lounge">
                      <CornerUpLeft />
                    </button>
                    <button
                      className="msg-action"
                      onClick={() => setMenuFor((value) => (value === message.id ? null : message.id))}
                      aria-label="Lounge message options"
                    >
                      <MoreHorizontal />
                    </button>
                    {menuFor === message.id && (
                      <div className="msg-menu">
                        <button onClick={() => { onReply(message, author); setMenuFor(null) }}><CornerUpLeft /> Reply</button>
                        {!mine && (
                          <button onClick={() => { setCardFor(author.id); setMenuFor(null) }}>
                            <UserPlus /> View @{author.handle}
                          </button>
                        )}
                        <div className="msg-menu-emojis">
                          {LOUNGE_REACTIONS.map((emoji) => (
                            <button key={emoji} onClick={() => { onReact(message.id, emoji); setMenuFor(null) }}>{emoji}</button>
                          ))}
                        </div>
                        {mine && (
                          <button className="danger" onClick={() => { onDelete(message.id); setMenuFor(null) }}>
                            <Trash2 /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {message.reactions?.length > 0 && (
                  <div className="msg-reactions">
                    {message.reactions.map((reaction) => {
                      const reacted = (reaction.userIds || []).includes(currentUser?.id)
                      return (
                        <button
                          key={reaction.emoji}
                          className={`reaction ${reacted ? 'mine' : ''}`}
                          onClick={() => onReact(message.id, reaction.emoji)}
                        >
                          {reaction.emoji} <b>{reaction.count}</b>
                        </button>
                      )
                    })}
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
              <span className="typing-label">{typingMember.name.split(' ')[0]} is typing in the Lounge</span>
            </div>
          </div>
        )}
      </div>

      {currentUser ? (
        <div className="chat-composer lounge-composer">
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
              <div className="mention-pop-label">Tag someone in the Lounge</div>
              {mentionMatches.map((member) => (
                <button key={member.id} className="mention-option" onClick={() => insertMention(member)}>
                  <Avatar member={member} size="sm" />
                  <span>
                    <strong>{member.name}</strong>
                    <small>@{member.handle}</small>
                  </span>
                  <em>{member.id === currentUser.id ? 'You' : 'Listener'}</em>
                </button>
              ))}
            </div>
          )}
          {recording ? (
            <div className="recording-console" data-testid="lounge-recording-bar">
              <span className="recording-dot" />
              <span className="recording-timer">{formatTime(recordSeconds)}</span>
              <div className="recording-wave" aria-hidden="true">
                {[0.35, 0.68, 0.94, 0.52, 0.8, 0.42, 0.72, 0.58, 0.88, 0.46, 0.76, 0.62].map((height, index) => (
                  <i key={index} style={{ height: `${Math.max(3, height * 18)}px`, animationDelay: `${index * 0.08}s` }} />
                ))}
              </div>
              <span className="recording-hint">{recordHint || `Recording · ${formatTime(45 - recordSeconds)} left`}</span>
              <button className="record-cancel" onClick={cancelRecording}>Cancel</button>
              <button className="record-send" onClick={() => finishRecording(false)}>
                <Send /> Send
              </button>
            </div>
          ) : (
            <>
              {emojiOpen && (
                <div className="emoji-pop">
                  {LYRIC_EMOJIS.slice(0, 12).map((emoji) => (
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
                  onDraft(`${draft}${prefix}@`)
                  setMention({ query: '', start: draft.length + prefix.length })
                  requestAnimationFrame(() => inputRef.current?.focus())
                }}
                aria-label="Mention someone in the Lounge"
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
                  placeholder={`Message the Lounge as @${currentLabel}…`}
                  aria-label="Public Lounge message"
                  data-testid="lounge-input"
                />
                <button
                  className="voice-note-btn"
                  onClick={startRecording}
                  aria-label="Record a Lounge voice note"
                  title="Record a voice note"
                  data-testid="lounge-voice-btn"
                >
                  <Mic />
                </button>
                <button className="send-btn" onClick={submitMessage} aria-label="Send Lounge message" data-testid="lounge-send-btn">
                  <Send />
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="lounge-guest-bar">
          <Globe2 />
          <span>You are reading as a guest.</span>
          <button onClick={onLogin}>Log in to join</button>
        </div>
      )}

      {cardMember && (
        <UserCard
          member={cardMember}
          currentUser={currentUser}
          room={room}
          inviting={invitingId === cardMember.id}
          onClose={() => setCardFor(null)}
          onInvite={(member) => {
            onInviteUser?.(member.id)
            setCardFor(null)
          }}
        />
      )}
    </aside>
  )
}
