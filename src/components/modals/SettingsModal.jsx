import { useEffect, useMemo, useRef, useState } from 'react'
import { accountDisplay, displayNameFromHandle, slugifyHandle, AVATAR_PRESETS } from '../../lib/appServices.js'
import { initials } from '../../lib/media'
import { ModalShell } from './ModalShell.jsx'
import {
  X,
  UserRoundPlus,
  SlidersHorizontal,
  UsersRound,
  HardDrive,
  LogOut,
  AlertCircle,
  Save,
  AudioLines,
  Clock3,
  Trash2,
} from 'lucide-react'
import { Avatar } from '../Avatar'

const AVATAR_SWATCHES = AVATAR_PRESETS.slice(0, 6)

function Toggle({ on, onClick, label }) {
  return (
    <button type="button" className={`toggle-pill ${on ? 'on' : ''}`} onClick={onClick} aria-label={label} aria-pressed={Boolean(on)}>
      <span />
    </button>
  )
}

export function SettingsModal({
  user,
  settings,
  stats,
  cacheInfo,
  onClose,
  onSaveProfile,
  onSaveSettings,
  onClearCache,
  onClearHistory,
  onSignOut,
}) {
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({
    name: user.name || displayNameFromHandle(user.handle || ''),
    handle: user.handle || '',
    bio: user.bio || '',
    email: user.email || '',
    showActivity: user.showActivity !== false,
    allowInvites: user.allowInvites !== false,
  })
  const [avatar, setAvatar] = useState({
    id: user.avatarId || AVATAR_SWATCHES[0].id,
    av1: user.av1 || AVATAR_SWATCHES[0].av1,
    av2: user.av2 || AVATAR_SWATCHES[0].av2,
  })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [audio, setAudio] = useState(settings)
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [audioSaved, setAudioSaved] = useState(false)
  const [socialSaved, setSocialSaved] = useState(false)
  const savedTimer = useRef(null)

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const flash = (setter) => {
    setter(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setter(false), 2400)
  }

  const preview = useMemo(() => accountDisplay({
    ...user,
    name: form.name || displayNameFromHandle(form.handle || user.handle),
    handle: form.handle || user.handle,
    initials: initials(form.name || displayNameFromHandle(form.handle || user.handle)),
    av1: avatar.av1,
    av2: avatar.av2,
  }), [user, form.name, form.handle, avatar.av1, avatar.av2])

  const resetSaveStates = () => {
    setProfileSaved(false)
    setAudioSaved(false)
    setSocialSaved(false)
  }

  const submitProfile = async (event) => {
    event.preventDefault()
    resetSaveStates()
    const result = await onSaveProfile({
      name: form.name,
      handle: form.handle,
      bio: form.bio,
      email: form.email,
      avatarId: avatar.id,
      avatar: { av1: avatar.av1, av2: avatar.av2 },
      showActivity: form.showActivity,
      allowInvites: form.allowInvites,
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    })
    if (result?.error) {
      setProfileError(result.error)
      return
    }
    setProfileError('')
    setPasswords({ currentPassword: '', newPassword: '' })
    flash(setProfileSaved)
  }

  const saveAudio = () => {
    resetSaveStates()
    onSaveSettings(audio)
    flash(setAudioSaved)
  }

  const saveSocial = async () => {
    resetSaveStates()
    const result = await onSaveProfile({
      name: form.name,
      handle: form.handle,
      bio: form.bio,
      email: form.email,
      avatarId: avatar.id,
      avatar: { av1: avatar.av1, av2: avatar.av2 },
      showActivity: form.showActivity,
      allowInvites: form.allowInvites,
    })
    if (result?.error) {
      setProfileError(result.error)
      return
    }
    setProfileError('')
    onSaveSettings(audio, { silent: true })
    flash(setSocialSaved)
  }

  const previewVolume = Math.round((Number(audio.defaultVolume ?? 0.82)) * 100)

  return (
    <ModalShell onClose={onClose} size="modal-settings">
      <div className="modal-head">
        <div>
          <span className="eyebrow"><span className="seg" /> SETTINGS</span>
          <h2>Your account & listening</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close settings"><X /></button>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRoundPlus /> Profile</button>
          <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><SlidersHorizontal /> Audio & playback</button>
          <button className={tab === 'social' ? 'active' : ''} onClick={() => setTab('social')}><UsersRound /> Social & privacy</button>
          <button className={tab === 'storage' ? 'active' : ''} onClick={() => setTab('storage')}><HardDrive /> Storage & cache</button>
          <span className="grow" />
          <button className="signout-btn" onClick={onSignOut}><LogOut /> Sign out</button>
        </nav>

        <div className="settings-body">
          {tab === 'profile' && (
            <form className="profile-form settings-profile-form" onSubmit={submitProfile}>
              <div className="profile-top settings-profile-top">
                <Avatar member={preview} size="avatar-xl" online />
                <div>
                  <strong>{preview.name}</strong>
                  <span>@{preview.handle} · {preview.email}</span>
                  <small>{form.bio || 'Your music, your rotation, your listening community.'}</small>
                </div>
              </div>

              <div className="profile-stats">
                <span><b>{stats.playlists}</b>Playlists created</span>
                <span><b>{stats.liked}</b>Liked songs</span>
                <span><b>{stats.rooms}</b>Rooms hosted</span>
              </div>

              <div className="settings-subhead">
                <strong>Public profile</strong>
                <span>This is how friends see you in rooms and the Lounge.</span>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Display name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((value) => ({ ...value, name: event.target.value.slice(0, 48) }))}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span>Username / handle</span>
                  <input
                    value={form.handle}
                    onChange={(event) => setForm((value) => ({ ...value, handle: slugifyHandle(event.target.value) }))}
                    placeholder="your.handle"
                    autoComplete="username"
                  />
                </label>
              </div>

              <label className="field">
                <span>Bio / status <i>{form.bio.length}/160</i></span>
                <textarea
                  value={form.bio}
                  maxLength={160}
                  rows={2}
                  onChange={(event) => setForm((value) => ({ ...value, bio: event.target.value }))}
                  placeholder="A line about what you are listening to"
                />
              </label>

              <div className="settings-avatar-picker" role="group" aria-label="Avatar color">
                <span>Avatar color</span>
                <div className="avatar-swatches">
                  {AVATAR_SWATCHES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`avatar-swatch ${avatar.id === preset.id ? 'active' : ''}`}
                      style={{ '--sw1': preset.av1, '--sw2': preset.av2 }}
                      onClick={() => setAvatar({ id: preset.id, av1: preset.av1, av2: preset.av2 })}
                      aria-label={`Use ${preset.id} avatar`}
                      aria-pressed={avatar.id === preset.id}
                    >
                      <span />
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-subhead">
                <strong>Account</strong>
                <span>Email changes may require confirmation. Leave password fields empty to keep your current one.</span>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Email address</span>
                  <input type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} autoComplete="email" />
                </label>
                <label className="field">
                  <span>Current password</span>
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(event) => setPasswords((value) => ({ ...value, currentPassword: event.target.value }))}
                    placeholder="Current password"
                    autoComplete="current-password"
                  />
                </label>
              </div>
              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords((value) => ({ ...value, newPassword: event.target.value }))}
                  placeholder="At least 4 characters"
                  autoComplete="new-password"
                />
              </label>

              {profileError && <span className="auth-error"><AlertCircle size={12} /> {profileError}</span>}
              <div className="profile-save-row">
                <button type="submit" className="primary-btn"><Save size={12} /> Save profile</button>
                {profileSaved && <span className="settings-saved" role="status">✓ Profile saved</span>}
              </div>
            </form>
          )}

          {tab === 'audio' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Audio & playback</h3>
                <p>Stream quality and defaults for every new listening session.</p>
              </div>
              <label className="field">
                <span>Streaming quality</span>
                <select value={audio.quality} onChange={(event) => setAudio((value) => ({ ...value, quality: event.target.value }))}>
                  <option value="high">320 kbps — High</option>
                  <option value="normal">160 kbps — Normal</option>
                </select>
              </label>
              <div className="setting-toggle-row">
                <div>
                  <strong>Autoplay</strong>
                  <span>Keep the music going with taste-matched radio when the queue ends.</span>
                </div>
                <Toggle on={audio.autoplay !== false} onClick={() => setAudio((value) => ({ ...value, autoplay: value.autoplay === false }))} label="Toggle autoplay" />
              </div>
              <label className="field">
                <span>Default volume · {previewVolume}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={previewVolume}
                  aria-label="Default volume"
                  onChange={(event) => {
                    const next = Number(event.target.value) / 100
                    setAudio((value) => ({ ...value, defaultVolume: next }))
                    onSaveSettings({ defaultVolume: next }, { silent: true })
                  }}
                />
              </label>
              <div className="settings-actions-row">
                <button className="primary-btn" onClick={saveAudio}><Save size={12} /> Save preferences</button>
                {audioSaved && <span className="settings-saved" role="status">✓ Audio saved</span>}
              </div>
            </div>
          )}

          {tab === 'social' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Social & privacy</h3>
                <p>You decide who gets to share your listening.</p>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Show my listening activity</strong>
                  <span>Let friends see when you’re in a room.</span>
                </div>
                <Toggle on={form.showActivity} onClick={() => setForm((value) => ({ ...value, showActivity: !value.showActivity }))} label="Toggle listening activity" />
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Allow direct room invites from anyone</strong>
                  <span>Turn off to only receive invites from people you know.</span>
                </div>
                <Toggle on={form.allowInvites} onClick={() => setForm((value) => ({ ...value, allowInvites: !value.allowInvites }))} label="Toggle direct room invites" />
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Public playlists by default</strong>
                  <span>New playlists are visible to your listening community.</span>
                </div>
                <Toggle
                  on={audio.defaultPlaylistPublic !== false}
                  onClick={() => setAudio((value) => ({ ...value, defaultPlaylistPublic: value.defaultPlaylistPublic === false }))}
                  label="Toggle public playlists by default"
                />
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Auto-translate lyrics by default</strong>
                  <span>Non-English songs open with English lyrics underneath.</span>
                </div>
                <Toggle on={Boolean(audio.autoTranslate)} onClick={() => setAudio((value) => ({ ...value, autoTranslate: !value.autoTranslate }))} label="Toggle auto-translate lyrics" />
              </div>
              <div className="settings-actions-row">
                <button className="primary-btn" onClick={saveSocial}><Save size={12} /> Save privacy</button>
                {socialSaved && <span className="settings-saved" role="status">✓ Privacy saved</span>}
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Storage & cache</h3>
                <p>Resolved streams, lyrics, translations, and listening history live on this device.</p>
              </div>
              <div className="cache-grid">
                <div><HardDrive /><strong>{cacheInfo.size}</strong><span>Total cache size</span></div>
                <div><AudioLines /><strong>{cacheInfo.streams}</strong><span>Cached streams</span></div>
                <div><Clock3 /><strong>{cacheInfo.history}</strong><span>Listening history</span></div>
              </div>
              <p className="settings-note">Clearing the cache removes saved stream and lyric data. Clearing history resets your recent rotation. The next play starts fresh.</p>
              <div className="settings-actions-row">
                <button className="text-btn danger-btn" onClick={onClearCache}><Trash2 size={12} /> Clear stream & lyrics cache</button>
                <button className="text-btn danger-btn" onClick={onClearHistory}><Clock3 size={12} /> Clear listening history</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
