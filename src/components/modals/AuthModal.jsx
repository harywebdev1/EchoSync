import { useState, useEffect } from 'react'
import { ModalShell } from './ModalShell.jsx'
import { Headphones, X, Radio, Mail, AtSign, Lock, AlertCircle, KeyRound, ArrowRight } from 'lucide-react'
import { slugifyHandle } from '../../lib/appServices.js'

export function AuthModal({ mode, reason, notice, pendingRoom, onClose, onSwitch, onSignIn, onSignUp, onGoogle, cloudMode = false }) {
  const [form, setForm] = useState({ email: '', username: '', identifier: '', password: '' })
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy,setBusy]=useState(false)

  useEffect(() => {
    setError('')
  }, [mode])

  const submit = async (event) => {
    event.preventDefault()
    if(busy)return
    setError('');setBusy(true)
    try {
    const result = await (mode === 'signin'
      ? onSignIn({ identifier: form.identifier, password: form.password, remember })
      : onSignUp({
        email: form.email,
        username: form.username,
        handle: form.username,
        password: form.password,
        remember,
      }))
    if (result?.error) setError(result.error)
    }catch(error){setError(error.message)}finally{setBusy(false)}
  }

  const switching = mode === 'signin' ? 'signup' : 'signin'

  return (
    <ModalShell onClose={onClose} size="modal-auth">
      <div className="auth-modal-head">
        <div className="auth-mark"><Headphones /></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close sign in"><X /></button>
      </div>
      <div className="auth-modal-copy">
        <span className="eyebrow"><span className="seg" /> {mode === 'signin' ? 'WELCOME BACK' : 'THREE FIELDS. THAT’S IT.'}</span>
        <h2>{mode === 'signin' ? 'Sign in to EchoSync' : 'Create your listening account'}</h2>
        <p>{reason || (mode === 'signin' ? 'Your library, rooms, and queue pick up where you left off.' : 'No display-name theatre. Pick a handle, add your email, and listen.')}</p>
      </div>

      {(pendingRoom || notice) && (
        <div className="auth-invite-note">
          <Radio size={13} />
          <span>{pendingRoom ? <>Room <b>{pendingRoom}</b> is waiting. Sign in and we’ll take you straight in.</> : notice}</span>
        </div>
      )}

      <div className="auth-switch auth-switch-top">
        <button className={mode === 'signin' ? 'active' : ''} onClick={() => onSwitch('signin')}>Log in</button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => onSwitch('signup')}>Sign up</button>
      </div>

      <button className="secondary-btn full" onClick={onGoogle} disabled={busy}>Continue with Google</button>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' ? (
          <>
            <label className="field">
              <span>Email</span>
              <div className="field-with-icon">
                <Mail />
                <input
                  type="email"
                  name="email"
                  data-testid="signup-email"
                  value={form.email}
                  onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </label>
            <label className="field">
              <span>Username</span>
              <div className="field-with-icon handle-field">
                <AtSign />
                <input
                  name="username"
                  data-testid="signup-username"
                  value={form.username}
                  onChange={(event) => setForm((value) => ({ ...value, username: slugifyHandle(event.target.value) }))}
                  placeholder="your.handle"
                  autoComplete="username"
                  required
                />
              </div>
              <small className="field-hint">Your handle will be @{form.username || 'your.handle'}</small>
            </label>
            <label className="field">
              <span>Password</span>
              <div className="field-with-icon">
                <Lock />
                <input
                  type="password"
                  name="password"
                  data-testid="signup-password"
                  value={form.password}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  placeholder="At least 4 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>{cloudMode?'Email':'Email or username'}</span>
              <div className="field-with-icon">
                <AtSign />
                <input
                  name="identifier"
                  data-testid="login-identifier"
                  value={form.identifier}
                  onChange={(event) => setForm((value) => ({ ...value, identifier: event.target.value }))}
                  placeholder="you@gmail.com or your.handle"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </label>
            <label className="field">
              <span>Password</span>
              <div className="field-with-icon">
                <Lock />
                <input
                  type="password"
                  name="password"
                  data-testid="login-password"
                  value={form.password}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>
          </>
        )}

        <label className="remember-row">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>Remember me on this device</span>
        </label>

        {error && <span className="auth-error"><AlertCircle size={12} /> {error}</span>}

        <button className="primary-btn full" type="submit" disabled={busy}>
          <KeyRound />
          {mode === 'signin' ? 'Log in' : 'Create account'}
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="auth-switch auth-switch-bottom">
        <span>{mode === 'signin' ? 'New to EchoSync?' : 'Already have an account?'}</span>
        <button onClick={() => onSwitch(switching)}>{mode === 'signin' ? 'Create an account' : 'Log in'}</button>
      </div>

      <p className="auth-legal">By continuing you agree to keep the aux cord democratic.</p>
    </ModalShell>
  )
}
