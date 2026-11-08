import { useCallback, useEffect, useState } from 'react'
import { supabase, configured } from './supabase'
import { ToastProvider, Icon, Spinner } from './ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MemberHome from './pages/MemberHome'
import Members from './pages/Members'
import Giving from './pages/Giving'
import Events from './pages/Events'
import Staff from './pages/Staff'

const ALL = ['admin', 'treasurer', 'secretary', 'member']
const NAV = [
  { id: 'home', label: 'Home', icon: 'home', roles: ALL },
  { id: 'members', label: 'Members', icon: 'users', roles: ['admin', 'treasurer', 'secretary'] },
  { id: 'giving', label: 'Giving', icon: 'heart', roles: ['admin', 'treasurer', 'member'] },
  { id: 'events', label: 'Events', icon: 'calendar', roles: ALL },
  { id: 'staff', label: 'Accounts', icon: 'shield', roles: ['admin', 'secretary'] },
]

function SetupNotice() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Almost there</h1>
        <p>
          This app needs your Supabase details. Add <b>VITE_SUPABASE_URL</b> and{' '}
          <b>VITE_SUPABASE_ANON_KEY</b> as environment variables, then redeploy.
        </p>
      </div>
    </div>
  )
}

function Shell() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [page, setPage] = useState('home')
  const [sub, setSub] = useState(null)

  const goto = (p, s = null) => {
    setPage(p)
    setSub(s)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data || null)
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) {
      setProfile(undefined)
      return
    }
    loadProfile(session.user.id)
  }, [session, loadProfile])

  const signOut = () => {
    setPage('home')
    setSub(null)
    return supabase.auth.signOut()
  }

  if (session === undefined) return <Spinner />
  if (!session) return <Login />
  if (profile === undefined) return <Spinner />

  const waiting = !profile || profile.role === 'pending' || (profile.role === 'member' && !profile.member_id)
  if (waiting) {
    const isMember = profile?.role === 'member'
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <img className="login-logo" src="/logo.png" alt="" />
          <h1>{isMember ? 'Waiting for approval' : 'Waiting for access'}</h1>
          <p>
            {isMember
              ? 'Your account is created. The church office will confirm your membership and unlock your account. Please check again later.'
              : profile
                ? 'Your account is created. The church admin needs to give you a role before you can continue.'
                : 'Your account has no staff profile yet. Ask the admin to check your account.'}
          </p>
          <button className="btn" onClick={() => loadProfile(session.user.id)}>
            Check again
          </button>
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const role = profile.role
  const isMember = role === 'member'
  const items = NAV.filter((n) => n.roles.includes(role)).map((n) => ({
    ...n,
    label: isMember && n.id === 'giving' ? 'My giving' : n.label,
  }))
  const current = items.find((n) => n.id === page) ? page : 'home'

  let view = null
  if (current === 'home') view = isMember ? <MemberHome profile={profile} goto={goto} /> : <Dashboard profile={profile} goto={goto} />
  if (current === 'members') view = <Members role={role} />
  if (current === 'giving') view = <Giving role={role} />
  if (current === 'events') view = <Events key={`events-${sub}`} role={role} initialTab={sub} />
  if (current === 'staff') view = <Staff me={profile} role={role} />

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="Gabetech Church logo" />
          <div>
            <strong>Gabetech Church</strong>
            <small>Kimilili</small>
          </div>
        </div>
        <nav>
          {items.map((n) => (
            <button key={n.id} className={`nav-item ${current === n.id ? 'on' : ''}`} onClick={() => goto(n.id)}>
              <Icon name={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div>
            <strong>{profile.full_name}</strong>
            <small>{profile.role}</small>
          </div>
          <button className="link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="" />
            <strong>Gabetech Church</strong>
          </div>
          <button className="link light" onClick={signOut}>
            Sign out
          </button>
        </header>
        <main className="content">{view}</main>
      </div>

      <nav className="tabs" aria-label="Main">
        {items.map((n) => (
          <button key={n.id} className={`tab ${current === n.id ? 'on' : ''}`} onClick={() => goto(n.id)}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return <ToastProvider>{configured ? <Shell /> : <SetupNotice />}</ToastProvider>
}
