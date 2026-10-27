import { useState, useEffect } from 'react'
import { ModalShell } from './ModalShell.jsx'
import { Headphones, X, Radio, Mail, AtSign, Lock, AlertCircle, KeyRound, ArrowRight } from 'lucide-react'
import { slugifyHandle } from '../../lib/appServices.js'

function GoogleIcon() {
  return (
    <svg className="google-g" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function AuthModal({ mode, reason, notice, pendingRoom, onClose, onSwitch, onSignIn, onSignUp, onGoogle, onResetPassword, onCompleteRecovery, cloudMode = false }) {
  const [form, setForm] = useState({ email: '', username: '', identifier: '', password: '' })
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy,setBusy]=useState(false)
  const [resetView,setResetView]=useState(false),[feedback,setFeedback]=useState(''),[legal,setLegal]=useState(null)

  useEffect(() => {
    setError('');setFeedback('');setResetView(false)
  }, [mode])

  const submit = async (event) => {
    event.preventDefault()
    if(busy)return
    setError('');setBusy(true)
    try {
    if(resetView || mode==='recovery'){
      const result=await(mode==='recovery'?onCompleteRecovery(form.password):onResetPassword(form.email))
      if(result?.error)setError(result.error);else setFeedback(result?.message||'Check your email for recovery instructions.')
      return
    }
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
  const previewUnlock = typeof reason === 'string' && reason.startsWith('Unlock full-length 320kbps streaming')

  return (
    <ModalShell onClose={onClose} size="modal-auth">
      <div className="auth-modal-head">
        <div className="auth-mark"><Headphones /></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close sign in"><X /></button>
      </div>
      <div className="auth-modal-copy">
        <span className="eyebrow"><span className="seg" /> {mode === 'signin' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</span>
        <h2>{mode==='recovery'?'Choose a new password':resetView?'Reset your password':mode === 'signin' ? 'Sign in to EchoSync' : 'Join EchoSync'}</h2>
        <p>{previewUnlock ? 'Your 30-second preview is up. Sign in and the full-length track resumes exactly where it stopped.' : reason || (mode === 'signin' ? 'Your library, rooms, and queue pick up where you left off.' : 'Stream full tracks, join live listening rooms, and chat in the Lounge.')}</p>
      </div>

      {previewUnlock && (
        <div className="auth-preview-banner" role="status" data-testid="auth-preview-banner">
          <Lock size={15} />
          <span>{reason}</span>
        </div>
      )}

      {(pendingRoom || notice) && (
        <div className="auth-invite-note">
          <Radio size={13} />
          <span>{pendingRoom ? <>Room <b>{pendingRoom}</b> is waiting. Sign in and we’ll take you straight in.</> : notice}</span>
        </div>
      )}

      {!resetView&&mode!=='recovery'&&<div className="auth-switch auth-switch-top">
        <button className={mode === 'signin' ? 'active' : ''} onClick={() => onSwitch('signin')}>Log in</button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => onSwitch('signup')}>Sign up</button>
      </div>}

      {!resetView&&mode!=='recovery'&&<button className="auth-google-btn" type="button" onClick={onGoogle} disabled={busy}><GoogleIcon /><span>Continue with Google</span></button>}
      <form className="auth-form" onSubmit={submit}>
        {resetView ? <label className="field"><span>Email</span><input type="email" required autoFocus autoComplete="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="you@example.com"/></label> : mode==='recovery' ? <label className="field"><span>New password</span><input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label> : mode === 'signup' ? (
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

        {!resetView&&mode==='signin'&&<button type="button" className="text-btn forgot-password" onClick={()=>{setResetView(true);setError('');setFeedback('');setForm(v=>({...v,email:v.identifier.includes('@')?v.identifier:''}))}}>Forgot password?</button>}
        {!resetView&&mode!=='recovery'&&<label className="remember-row">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>Remember me on this device</span>
        </label>}

        {feedback&&<p role="status">{feedback}</p>}
        {error && <span className="auth-error" role="alert"><AlertCircle size={12} /> {error}</span>}

        <button className="primary-btn full" type="submit" disabled={busy}>
          <KeyRound />
          {mode==='recovery'?'Update password':resetView?'Send reset link':mode === 'signin' ? 'Log in' : 'Create account'}
          <ArrowRight size={16} />
        </button>
      </form>

      {resetView ? <button className="text-btn" onClick={()=>{setResetView(false);setFeedback('');setError('')}}>Back to sign in</button> : mode==='recovery' ? <button className="text-btn" onClick={onClose}>Return to listening</button> : <div className="auth-switch auth-switch-bottom">
        <span>{mode === 'signin' ? 'New to EchoSync?' : 'Already have an account?'}</span>
        <button onClick={() => onSwitch(switching)}>{mode === 'signin' ? 'Create an account' : 'Log in'}</button>
      </div>}

      <p className="auth-legal"><a href="#terms" onClick={e=>{e.preventDefault();setLegal('terms')}}>Terms of Service</a> · <a href="#privacy" onClick={e=>{e.preventDefault();setLegal('privacy')}}>Privacy Policy</a> · {cloudMode?'Encrypted via Supabase Auth':'Local device storage'}</p>
      {legal&&<section className="auth-trust-summary" aria-label={legal==='terms'?'Terms of Service':'Privacy Policy'}><h3>{legal==='terms'?'Terms of Service':'Privacy Policy'}</h3><p>{legal==='terms'?'Use EchoSync respectfully. Share only content you have permission to share. Music availability depends on upstream providers; rooms and public posts must respect other listeners.':'Guest likes and listening preferences stay on this device. Signing in stores profile and library data in Supabase. Public profiles, Lounge posts and shared voice URLs can be read by others; keep private information out of public posts. Passwords are handled by Supabase Auth in cloud mode.'}</p><button className="text-btn" onClick={()=>setLegal(null)}>Close summary</button></section>}
    </ModalShell>
  )
}
