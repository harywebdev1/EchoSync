import { useState } from 'react'
import { accountDisplay, displayNameFromHandle, slugifyHandle } from '../../lib/appServices.js'
import { initials } from '../../lib/media'
import { ModalShell } from './ModalShell.jsx'
import {
  X,
  UserRoundPlus,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  HardDrive,
  LogOut,
  AlertCircle,
  Save,
  AudioLines,
  Languages,
  Trash2,
} from 'lucide-react'
import { Avatar } from '../Avatar'
import { topTasteLabels } from '../../core/tasteEngine.js'
import { TastePicker } from './TastePicker.jsx'

export function SettingsModal({
  user,
  settings,
  stats,
  cacheInfo,
  tasteProfile,
  onClose,
  onSaveProfile,
  onSaveSettings,
  onClearCache,
  onSignOut,
  onSaveTaste,
}) {
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({
    handle: user.handle || '',
    email: user.email || '',
    showActivity: user.showActivity !== false,
    allowInvites: user.allowInvites !== false,
  })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [audio, setAudio] = useState(settings)
  const [profileError, setProfileError] = useState('')

  const preview = accountDisplay({
    ...user,
    name: displayNameFromHandle(form.handle || user.handle),
    handle: form.handle || user.handle,
    initials: initials(displayNameFromHandle(form.handle || user.handle)),
  })

  const submitProfile = (event) => {
    event.preventDefault()
    const result = onSaveProfile({
      name: displayNameFromHandle(form.handle),
      handle: form.handle,
      email: form.email,
      showActivity: form.showActivity,
      allowInvites: form.allowInvites,
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    })
    if (result?.error) setProfileError(result.error)
    else {
      setProfileError('')
      setPasswords({ currentPassword: '', newPassword: '' })
    }
  }

  const saveAudio = () => {
    onSaveSettings(audio)
  }

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
        <nav className="settings-nav">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRoundPlus /> Profile</button>
          <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><SlidersHorizontal /> Audio & playback</button>
          <button className={tab === 'taste' ? 'active' : ''} onClick={() => setTab('taste')}><Sparkles /> Taste profile</button>
          <button className={tab === 'social' ? 'active' : ''} onClick={() => setTab('social')}><UsersRound /> Social & privacy</button>
          <button className={tab === 'storage' ? 'active' : ''} onClick={() => setTab('storage')}><HardDrive /> Storage & cache</button>
          <span className="grow" />
          <button className="signout-btn" onClick={onSignOut}><LogOut /> Sign out</button>
        </nav>

        <div className="settings-body">
          {tab === 'profile' && (
            <form className="profile-form" onSubmit={submitProfile}>
              <div className="profile-top settings-profile-top">
                <Avatar member={preview} size="avatar-xl" online />
                <div>
                  <strong>{preview.name}</strong>
                  <span>@{preview.handle} · {preview.email}</span>
                  <small>Your music, your rotation, your listening community.</small>
                </div>
              </div>
              <div className="profile-stats">
                <span><b>{stats.playlists}</b>Playlists created</span>
                <span><b>{stats.liked}</b>Liked songs</span>
                <span><b>{stats.rooms}</b>Rooms hosted</span>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Username</span>
                  <input value={form.handle} onChange={(event) => setForm((value) => ({ ...value, handle: slugifyHandle(event.target.value) }))} placeholder="your.handle" autoComplete="username" />
                </label>
                <label className="field">
                  <span>Email address</span>
                  <input type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} autoComplete="email" />
                </label>
              </div>
              <div className="settings-subhead">
                <strong>Change password</strong>
                <span>Leave both fields empty to keep your current password.</span>
              </div>
              <div className="field-row">
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
              </div>
              {profileError && <span className="auth-error"><AlertCircle size={12} /> {profileError}</span>}
              <div className="modal-actions">
                <button type="submit" className="primary-btn"><Save size={12} /> Save profile</button>
              </div>
            </form>
          )}

          {tab === 'audio' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Audio & playback</h3>
                <p>Choose the stream quality that fits your connection.</p>
              </div>
              <label className="field">
                <span>Streaming quality</span>
                <select value={audio.quality} onChange={(event) => setAudio((value) => ({ ...value, quality: event.target.value }))}>
                  <option value="high">High — 320 kbps</option>
                  <option value="normal">Normal — 160 kbps</option>
                  <option value="saver">Data saver — 96 kbps</option>
                </select>
              </label>
              <div className="setting-toggle-row">
                <div>
                  <strong>Crossfade</strong>
                  <span>Ease between tracks instead of a hard cut.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.crossfade ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, crossfade: !value.crossfade }))}
                  aria-label="Toggle crossfade"
                >
                  <span />
                </button>
              </div>
              <label className="field">
                <span>Crossfade length · {audio.crossfadeSeconds}s</span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={audio.crossfadeSeconds}
                  onChange={(event) => setAudio((value) => ({ ...value, crossfadeSeconds: Number(event.target.value) }))}
                  disabled={!audio.crossfade}
                />
              </label>
              <div className="setting-toggle-row">
                <div>
                  <strong>Gapless playback</strong>
                  <span>Keep continuous albums continuous.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.gapless ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, gapless: !value.gapless }))}
                  aria-label="Toggle gapless playback"
                >
                  <span />
                </button>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Volume normalisation</strong>
                  <span>Even out loud and quiet masters.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.normalization ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, normalization: !value.normalization }))}
                  aria-label="Toggle volume normalisation"
                >
                  <span />
                </button>
              </div>
              <label className="field">
                <span>Rave mic ducking level</span>
                <select value={audio.duckLevel} onChange={(event) => setAudio((value) => ({ ...value, duckLevel: Number(event.target.value) }))}>
                  <option value={15}>15% — subtle</option>
                  <option value={20}>20% — balanced</option>
                  <option value={35}>35% — voice forward</option>
                </select>
              </label>
              <div className="modal-actions">
                <button className="primary-btn" onClick={saveAudio}><Save size={12} /> Save preferences</button>
              </div>
            </div>
          )}

          {tab === 'taste' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Taste profile</h3>
                <p>Shape Search suggestions and daily mixes without changing who you follow or listen with.</p>
              </div>
              {topTasteLabels(tasteProfile.artists, 3).length > 0 && (
                <div className="taste-summary">
                  <span>Strongest signals</span>
                  <div>
                    {topTasteLabels(tasteProfile.artists, 3).map((artist) => <b key={artist}>{artist}</b>)}
                    {topTasteLabels(tasteProfile.languages, 1).map((language) => <b key={language}>{language}</b>)}
                  </div>
                </div>
              )}
              <TastePicker selected={tasteProfile.tuned} onSave={onSaveTaste} />
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
                <button
                  type="button"
                  className={`toggle-pill ${form.showActivity ? 'on' : ''}`}
                  onClick={() => setForm((value) => ({ ...value, showActivity: !value.showActivity }))}
                  aria-label="Toggle listening activity"
                >
                  <span />
                </button>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Allow direct room invites from anyone</strong>
                  <span>Turn off to only receive invites from people you know.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${form.allowInvites ? 'on' : ''}`}
                  onClick={() => setForm((value) => ({ ...value, allowInvites: !value.allowInvites }))}
                  aria-label="Toggle direct room invites"
                >
                  <span />
                </button>
              </div>
              <div className="setting-toggle-row">
                <div>
                  <strong>Auto-translate lyrics by default</strong>
                  <span>Non-English songs open with English lyrics underneath.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-pill ${audio.autoTranslate ? 'on' : ''}`}
                  onClick={() => setAudio((value) => ({ ...value, autoTranslate: !value.autoTranslate }))}
                  aria-label="Toggle auto-translate lyrics"
                >
                  <span />
                </button>
              </div>
              <div className="modal-actions">
                <button
                  className="primary-btn"
                  onClick={() => {
                    const result = onSaveProfile({ ...form })
                    if (result?.error) setProfileError(result.error)
                    onSaveSettings(audio)
                  }}
                >
                  <Save size={12} /> Save privacy
                </button>
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <h3>Storage & cache</h3>
                <p>Resolved streams, lyrics, and translations live on this device.</p>
              </div>
              <div className="cache-grid">
                <div><HardDrive /><strong>{cacheInfo.size}</strong><span>Total cache size</span></div>
                <div><AudioLines /><strong>{cacheInfo.streams}</strong><span>Cached streams</span></div>
                <div><Languages /><strong>{cacheInfo.translations}</strong><span>Translated tracks</span></div>
              </div>
              <p className="settings-note">Clearing the cache removes saved stream and lyric data. The next play starts fresh.</p>
              <div className="settings-actions-row">
                <button className="text-btn danger-btn" onClick={onClearCache}><Trash2 size={12} /> Clear stream & lyrics cache</button>
                <span className="grow" />
                <button className="text-btn ghosted" onClick={onSignOut}><LogOut size={12} /> Sign out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
