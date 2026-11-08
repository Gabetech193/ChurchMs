import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { money, fmtShort } from '../utils'
import { Spinner } from '../ui'

const pad = (n) => String(n).padStart(2, '0')

function lastSixMonths() {
  const now = new Date()
  const out = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: d.toLocaleString('en-GB', { month: 'short' }),
      start: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
    })
  }
  return out
}

export default function Dashboard({ profile, goto }) {
  const seeMoney = profile.role === 'admin' || profile.role === 'treasurer'
  const months = useMemo(lastSixMonths, [])
  const [members, setMembers] = useState(null)
  const [giving, setGiving] = useState([])
  const [events, setEvents] = useState([])
  const [notices, setNotices] = useState([])

  useEffect(() => {
    ;(async () => {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const [m, ev, no] = await Promise.all([
        supabase.from('members').select('id,full_name,phone,status,date_of_birth,join_date').limit(5000),
        supabase
          .from('events')
          .select('id,title,start_at,location')
          .gte('start_at', startOfToday.toISOString())
          .order('start_at')
          .limit(3),
        supabase
          .from('notices')
          .select('id,title,body,pinned,created_at')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(3),
      ])
      setMembers(m.data || [])
      setEvents(ev.data || [])
      setNotices(no.data || [])
      if (seeMoney) {
        const g = await supabase
          .from('giving')
          .select('giving_date,amount,giving_type')
          .gte('giving_date', months[0].start)
          .limit(20000)
        setGiving(g.data || [])
      }
    })()
  }, [seeMoney, months])

  if (!members) return <Spinner />

  const active = members.filter((m) => m.status === 'active')
  const visitors = members.filter((m) => m.status === 'visitor').length
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const newMembers = members.filter((m) => m.join_date && m.join_date >= thirtyAgo).length

  const tithe = months.map((mo) =>
    giving
      .filter((g) => g.giving_type === 'tithe' && g.giving_date.startsWith(mo.key))
      .reduce((s, g) => s + Number(g.amount), 0)
  )
  const offering = months.map((mo) =>
    giving
      .filter((g) => g.giving_type !== 'tithe' && g.giving_date.startsWith(mo.key))
      .reduce((s, g) => s + Number(g.amount), 0)
  )
  const totals = tithe.map((t, i) => t + offering[i])
  const max = Math.max(...totals, 1)

  const mm = pad(new Date().getMonth() + 1)
  const birthdays = members
    .filter((m) => m.status !== 'deceased' && m.date_of_birth && m.date_of_birth.slice(5, 7) === mm)
    .sort((a, b) => a.date_of_birth.slice(8) - b.date_of_birth.slice(8))
    .slice(0, 6)

  const first = (profile.full_name || '').split(' ')[0]
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <h1 className="page-title tight">Welcome, {first}</h1>
      <p className="muted date-line">{today}</p>

      <div className="tiles">
        {seeMoney && (
          <>
            <button className="tile accent-blue" onClick={() => goto('giving')}>
              <small>Tithe this month</small>
              <strong>{money(tithe[5])}</strong>
            </button>
            <button className="tile accent-gold" onClick={() => goto('giving')}>
              <small>Offering this month</small>
              <strong>{money(offering[5])}</strong>
            </button>
          </>
        )}
        <button className="tile" onClick={() => goto('members')}>
          <small>Active members</small>
          <strong>{active.length}</strong>
        </button>
        {seeMoney ? (
          <div className="tile">
            <small>Joined in 30 days</small>
            <strong>{newMembers}</strong>
          </div>
        ) : (
          <>
            <div className="tile">
              <small>Joined in 30 days</small>
              <strong>{newMembers}</strong>
            </div>
            <div className="tile">
              <small>Visitors</small>
              <strong>{visitors}</strong>
            </div>
          </>
        )}
      </div>

      {seeMoney && (
        <section className="panel">
          <div className="panel-head">
            <h2>Giving, last 6 months</h2>
            <div className="legend">
              <span><i className="dot blue" />Tithe</span>
              <span><i className="dot gold" />Offering</span>
            </div>
          </div>
          <div className="chart" role="img" aria-label="Tithe and offering over the last six months">
            {months.map((mo, i) => (
              <div className="chart-col" key={mo.key} title={`${mo.label}: ${money(totals[i])}`}>
                <div className="chart-track">
                  <div className="chart-stack">
                    <div className="seg-offering" style={{ height: `${(offering[i] / max) * 100}%` }} />
                    <div className="seg-tithe" style={{ height: `${(tithe[i] / max) * 100}%` }} />
                  </div>
                </div>
                <span>{mo.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Upcoming events</h2>
            <button className="link" onClick={() => goto('events')}>See all</button>
          </div>
          {events.length === 0 ? (
            <p className="muted">Nothing scheduled yet.</p>
          ) : (
            <ul className="plain">
              {events.map((ev) => (
                <li key={ev.id}>
                  <span className="date-badge">
                    <b>{new Date(ev.start_at).getDate()}</b>
                    {new Date(ev.start_at).toLocaleString('en-GB', { month: 'short' })}
                  </span>
                  <span className="grow">
                    <strong>{ev.title}</strong>
                    <small className="block">
                      {new Date(ev.start_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
                      {ev.location ? `  |  ${ev.location}` : ''}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Notices</h2>
            <button className="link" onClick={() => goto('events', 'notices')}>See all</button>
          </div>
          {notices.length === 0 ? (
            <p className="muted">No notices yet.</p>
          ) : (
            <ul className="plain">
              {notices.map((n) => (
                <li key={n.id}>
                  <span className="grow">
                    <strong>{n.pinned ? '📌 ' : ''}{n.title}</strong>
                    <small className="block clamp">{n.body}</small>
                  </span>
                  <small>{fmtShort(n.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Birthdays this month</h2>
          </div>
          {birthdays.length === 0 ? (
            <p className="muted">No birthdays recorded for this month.</p>
          ) : (
            <ul className="plain">
              {birthdays.map((m) => (
                <li key={m.id}>
                  <span className="grow">{m.full_name}</span>
                  <small>{fmtShort(m.date_of_birth)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
