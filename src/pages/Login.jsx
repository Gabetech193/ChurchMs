import { useState } from 'react'
import { supabase } from '../supabase'
import { memberEmail, normalizePhone, validPhone } from '../utils'

export default function Login() {
  const [who, setWho] = useState('staff') // staff | member
  const [mode, setMode] = useState('in') // in | up
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const isMember = who === 'member'

  const switchWho = (w) => {
    setWho(w)
    setMode('in')
    setMsg(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)

    if (isMember && !validPhone(phone)) {
      setMsg({ kind: 'err', text: 'Enter a valid phone number, for example 0712345678.' })
      setBusy(false)
      return
    }
    const loginId = isMember ? memberEmail(phone) : email

    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email: loginId, password })
      if (error)
        setMsg({
          kind: 'err',
          text:
            error.message === 'Invalid login credentials'
              ? isMember
                ? 'Wrong phone number or password.'
                : 'Wrong email or password.'
              : error.message,
        })
    } else {
      const meta = isMember
        ? { full_name: name.trim(), phone: normalizePhone(phone), account_type: 'member' }
        : { full_name: name.trim() }
      const { data, error } = await supabase.auth.signUp({
        email: loginId,
        password,
        options: { data: meta },
      })
      if (error)
        setMsg({
          kind: 'err',
          text: /already registered/i.test(error.message)
            ? isMember
              ? 'This phone number already has an account. Try signing in.'
              : 'This email already has an account. Try signing in.'
            : error.message,
        })
      else if (!data.session)
        setMsg({
          kind: 'ok',
          text: isMember
            ? 'Account created. Please sign in.'
            : 'Account created. Check your email to confirm it, then sign in.',
        })
    }
    setBusy(false)
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <img className="login-logo" src="/logo.png" alt="Gabetech Church Kimilili" />
        <h1>Gabetech Church</h1>

        <div className="seg wide-seg" role="tablist">
          <button type="button" role="tab" aria-selected={!isMember} className={!isMember ? 'on' : ''} onClick={() => switchWho('staff')}>
            Church staff
          </button>
          <button type="button" role="tab" aria-selected={isMember} className={isMember ? 'on' : ''} onClick={() => switchWho('member')}>
            Member
          </button>
        </div>

        <p>
          {isMember
            ? mode === 'in'
              ? 'Sign in with your phone number to see events, notices and your giving.'
              : 'Create your member account. The church office will approve it.'
            : mode === 'in'
              ? 'Sign in to manage the church.'
              : 'Create your staff account.'}
        </p>

        {mode === 'up' && (
          <label className="field">
            <span>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}

        {isMember ? (
          <label className="field">
            <span>Phone number</span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </label>
        ) : (
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
        )}

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          />
        </label>

        {isMember && mode === 'up' && (
          <small className="hint">Use the phone number the church already has for you, so we can match your record.</small>
        )}

        {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}

        <button className="btn" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="link center"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setMsg(null)
          }}
        >
          {mode === 'in'
            ? isMember
              ? 'New member? Create an account'
              : 'New staff member? Create an account'
            : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
