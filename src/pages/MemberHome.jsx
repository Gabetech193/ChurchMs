import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { money, fmtShort, label } from '../utils'
import { Spinner } from '../ui'

export default function MemberHome({ profile, goto }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    ;(async () => {
      const year = new Date().getFullYear()
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const [me, g, ev, no] = await Promise.all([
        supabase.from('members').select('full_name,member_no').eq('id', profile.member_id).maybeSingle(),
        supabase
          .from('giving')
          .select('id,giving_date,amount,giving_type,receipt_no')
          .gte('giving_date', `${year}-01-01`)
          .order('giving_date', { ascending: false })
          .limit(2000),
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
      setData({ me: me.data, giving: g.data || [], events: ev.data || [], notices: no.data || [] })
    })()
  }, [profile.member_id])

  if (!data) return <Spinner />

  const sum = (rows) => rows.reduce((s, r) => s + Number(r.amount), 0)
  const tithe = sum(data.giving.filter((g) => g.giving_type === 'tithe'))
  const offering = sum(data.giving.filter((g) => g.giving_type !== 'tithe'))
  const first = (data.me?.full_name || profile.full_name || '').split(' ')[0]

  return (
    <div className="page">
      <h1 className="page-title tight">Welcome, {first}</h1>
      {data.me?.member_no && <p className="muted date-line">Member no. {data.me.member_no}</p>}

      <div className="tiles">
        <button className="tile accent-blue" onClick={() => goto('giving')}>
          <small>My tithe this year</small>
          <strong>{money(tithe)}</strong>
        </button>
        <button className="tile accent-gold" onClick={() => goto('giving')}>
          <small>My offering this year</small>
          <strong>{money(offering)}</strong>
        </button>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Upcoming events</h2>
            <button className="link" onClick={() => goto('events')}>See all</button>
          </div>
          {data.events.length === 0 ? (
            <p className="muted">Nothing scheduled yet.</p>
          ) : (
            <ul className="plain">
              {data.events.map((ev) => (
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
          {data.notices.length === 0 ? (
            <p className="muted">No notices yet.</p>
          ) : (
            <ul className="plain">
              {data.notices.map((n) => (
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
            <h2>My recent giving</h2>
            <button className="link" onClick={() => goto('giving')}>See all</button>
          </div>
          {data.giving.length === 0 ? (
            <p className="muted">No giving recorded this year yet.</p>
          ) : (
            <ul className="plain">
              {data.giving.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <span className="grow">
                    <strong>{label(g.giving_type)}</strong>
                    <small className="block">{fmtShort(g.giving_date)}  |  {g.receipt_no}</small>
                  </span>
                  <span className="amount">{money(g.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
