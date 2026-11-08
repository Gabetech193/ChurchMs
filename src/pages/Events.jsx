import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { Modal, Field, Spinner, Empty, useToast } from '../ui'
import { label, fmtShort } from '../utils'

const TYPES = ['service', 'meeting', 'conference', 'crusade', 'wedding', 'funeral', 'fellowship', 'other']

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/* ---------------- Events ---------------- */

function EventForm({ event, canWrite, canDelete, onSaved, onClose }) {
  const toast = useToast()
  const isNew = !event.id
  const [form, setForm] = useState({
    title: event.title || '',
    event_type: event.event_type || 'service',
    location: event.location || '',
    start_at: toLocalInput(event.start_at),
    end_at: toLocalInput(event.end_at),
    description: event.description || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    const payload = {
      title: form.title.trim(),
      event_type: form.event_type,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
    }
    const q = isNew
      ? supabase.from('events').insert(payload)
      : supabase.from('events').update(payload).eq('id', event.id)
    const { error } = await q
    setBusy(false)
    if (error) return toast(error.message, 'err')
    toast(isNew ? 'Event added' : 'Event updated')
    onSaved()
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${event.title}" and its attendance records?`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) return toast(error.message, 'err')
    toast('Event deleted')
    onSaved()
  }

  return (
    <Modal
      title={isNew ? 'Add event' : 'Edit event'}
      onClose={onClose}
      footer={
        <>
          {!isNew && canDelete && (
            <button type="button" className="btn danger ghost" onClick={remove}>
              Delete
            </button>
          )}
          <button type="submit" form="event-form" className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save event'}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={save}>
        <fieldset disabled={!canWrite} className="grid">
          <Field label="Title" wide>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Sunday Service" required />
          </Field>
          <Field label="Type">
            <select value={form.event_type} onChange={set('event_type')}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input value={form.location} onChange={set('location')} />
          </Field>
          <Field label="Starts">
            <input type="datetime-local" value={form.start_at} onChange={set('start_at')} required />
          </Field>
          <Field label="Ends (optional)">
            <input type="datetime-local" value={form.end_at} onChange={set('end_at')} />
          </Field>
          <Field label="Details" wide>
            <textarea rows="3" value={form.description} onChange={set('description')} />
          </Field>
        </fieldset>
      </form>
    </Modal>
  )
}

function EventDetail({ event, onClose }) {
  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="receipt left">
        <dl>
          <dt>When</dt>
          <dd>{fmtWhen(event.start_at)}</dd>
          <dt>Type</dt>
          <dd>{label(event.event_type)}</dd>
          {event.location && (
            <>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </>
          )}
        </dl>
        {event.description && <p className="pre">{event.description}</p>}
      </div>
    </Modal>
  )
}

function Attendance({ event, canWrite, onClose }) {
  const toast = useToast()
  const [members, setMembers] = useState(null)
  const [present, setPresent] = useState(new Set())
  const [q, setQ] = useState('')
  const [onlyPresent, setOnlyPresent] = useState(false)

  const load = useCallback(async () => {
    const [m, a] = await Promise.all([
      supabase.from('members').select('id,full_name,member_no,phone').eq('status', 'active').order('full_name').limit(5000),
      supabase.from('attendance').select('member_id').eq('event_id', event.id).limit(10000),
    ])
    if (m.error) toast(m.error.message, 'err')
    if (a.error) toast(a.error.message, 'err')
    setMembers(m.data || [])
    setPresent(new Set((a.data || []).map((r) => r.member_id)))
  }, [event.id, toast])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (m) => {
    if (!canWrite) return
    const isIn = present.has(m.id)
    setPresent((s) => {
      const n = new Set(s)
      isIn ? n.delete(m.id) : n.add(m.id)
      return n
    })
    const { error } = isIn
      ? await supabase.from('attendance').delete().eq('event_id', event.id).eq('member_id', m.id)
      : await supabase.from('attendance').insert({ event_id: event.id, member_id: m.id })
    if (error) {
      toast(error.message, 'err')
      load()
    }
  }

  const list = useMemo(() => {
    if (!members) return []
    const s = q.trim().toLowerCase()
    return members.filter(
      (m) =>
        (!onlyPresent || present.has(m.id)) &&
        (!s ||
          m.full_name.toLowerCase().includes(s) ||
          (m.phone || '').includes(s) ||
          (m.member_no || '').toLowerCase().includes(s))
    )
  }, [members, q, onlyPresent, present])

  return (
    <Modal title={event.title} onClose={onClose}>
      <p className="muted att-when">{fmtWhen(event.start_at)}</p>
      {!members ? (
        <Spinner />
      ) : (
        <>
          <div className="att-count">
            <strong>{present.size}</strong>
            <span>present of {members.length} active members</span>
          </div>
          <div className="filters">
            <input className="search" type="search" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className={`btn ghost ${onlyPresent ? 'on' : ''}`} onClick={() => setOnlyPresent((v) => !v)}>
              {onlyPresent ? 'Show all' : 'Present only'}
            </button>
          </div>
          {!canWrite && <p className="muted">You can view attendance but not change it.</p>}
          {list.length === 0 ? (
            <Empty title="No members to show" hint={members.length === 0 ? 'Add active members first.' : undefined} />
          ) : (
            <ul className="rows">
              {list.map((m) => {
                const on = present.has(m.id)
                return (
                  <li key={m.id}>
                    <button className="row" onClick={() => toggle(m)} aria-pressed={on} disabled={!canWrite}>
                      <span className={`tick ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
                      <span className="row-main">
                        <strong>{m.full_name}</strong>
                        <small>{[m.member_no, m.phone].filter(Boolean).join('  |  ')}</small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}

function EventsList({ role }) {
  const toast = useToast()
  const isMember = role === 'member'
  const canWrite = role === 'admin' || role === 'secretary'
  const [events, setEvents] = useState(null)
  const [counts, setCounts] = useState({})
  const [tab, setTab] = useState('upcoming')
  const [editing, setEditing] = useState(null)
  const [marking, setMarking] = useState(null)
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    const e = await supabase.from('events').select('*').order('start_at', { ascending: false }).limit(500)
    if (e.error) toast(e.error.message, 'err')
    else setEvents(e.data)
    if (!isMember) {
      const a = await supabase.from('attendance').select('event_id').limit(50000)
      const c = {}
      ;(a.data || []).forEach((r) => {
        c[r.event_id] = (c[r.event_id] || 0) + 1
      })
      setCounts(c)
    }
  }, [toast, isMember])

  useEffect(() => {
    load()
  }, [load])

  const list = useMemo(() => {
    if (!events) return []
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const up = events.filter((ev) => new Date(ev.start_at) >= startOfToday)
    const past = events.filter((ev) => new Date(ev.start_at) < startOfToday)
    return tab === 'upcoming' ? up.reverse() : past
  }, [events, tab])

  if (!events) return <Spinner />

  return (
    <>
      <div className="toolbar">
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'upcoming'} className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>
            Upcoming
          </button>
          <button role="tab" aria-selected={tab === 'past'} className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>
            Past
          </button>
        </div>
        {canWrite && (
          <button className="btn" onClick={() => setEditing({})}>
            Add event
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <Empty
          title={tab === 'upcoming' ? 'No upcoming events' : 'No past events'}
          hint={tab === 'upcoming' && canWrite ? 'Tap Add event to schedule a service or meeting.' : undefined}
        />
      ) : (
        <ul className="rows">
          {list.map((ev) => (
            <li key={ev.id} className="event-item">
              <button className="row" onClick={() => (isMember ? setViewing(ev) : setMarking(ev))}>
                <span className="row-main">
                  <strong>{ev.title}</strong>
                  <small>
                    {fmtWhen(ev.start_at)}
                    {ev.location ? `  |  ${ev.location}` : ''}
                  </small>
                </span>
                <span className="chip">{label(ev.event_type)}</span>
                {!isMember && (
                  <span className="att-pill" title="Attendance">
                    {counts[ev.id] || 0}
                  </span>
                )}
              </button>
              {canWrite && (
                <button className="link edit-link" onClick={() => setEditing(ev)}>
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EventForm
          event={editing}
          canWrite={canWrite}
          canDelete={canWrite}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {marking && (
        <Attendance
          event={marking}
          canWrite={canWrite}
          onClose={() => {
            setMarking(null)
            load()
          }}
        />
      )}
      {viewing && <EventDetail event={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

/* ---------------- Notices ---------------- */

function NoticeForm({ notice, onSaved, onClose }) {
  const toast = useToast()
  const isNew = !notice.id
  const [form, setForm] = useState({
    title: notice.title || '',
    body: notice.body || '',
    pinned: Boolean(notice.pinned),
  })
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    const payload = { title: form.title.trim(), body: form.body.trim() || null, pinned: form.pinned }
    const q = isNew
      ? supabase.from('notices').insert(payload)
      : supabase.from('notices').update(payload).eq('id', notice.id)
    const { error } = await q
    setBusy(false)
    if (error) return toast(error.message, 'err')
    toast(isNew ? 'Notice posted' : 'Notice updated')
    onSaved()
  }

  const remove = async () => {
    if (!window.confirm('Delete this notice?')) return
    const { error } = await supabase.from('notices').delete().eq('id', notice.id)
    if (error) return toast(error.message, 'err')
    toast('Notice deleted')
    onSaved()
  }

  return (
    <Modal
      title={isNew ? 'New notice' : 'Edit notice'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn danger ghost" onClick={remove}>
              Delete
            </button>
          )}
          <button type="submit" form="notice-form" className="btn" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Post notice' : 'Save'}
          </button>
        </>
      }
    >
      <form id="notice-form" onSubmit={save} className="grid">
        <Field label="Title" wide>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </Field>
        <Field label="Message" wide>
          <textarea rows="6" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <label className="check wide">
          <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
          <span>Pin to the top</span>
        </label>
      </form>
    </Modal>
  )
}

function Notices({ role }) {
  const toast = useToast()
  const canWrite = role === 'admin' || role === 'secretary'
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) toast(error.message, 'err')
    else setRows(data)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  if (!rows) return <Spinner />

  return (
    <>
      {canWrite && (
        <div className="toolbar end">
          <button className="btn" onClick={() => setEditing({})}>
            New notice
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty title="No notices yet" hint={canWrite ? 'Post an announcement for your members.' : 'Announcements from the church will show here.'} />
      ) : (
        <div className="cards">
          {rows.map((n) => (
            <article key={n.id} className={`notice-card ${n.pinned ? 'pinned' : ''}`}>
              <header>
                <strong>{n.title}</strong>
                <small>{fmtShort(n.created_at)}</small>
              </header>
              {n.pinned && <span className="chip visitor">Pinned</span>}
              {n.body && <p className="pre">{n.body}</p>}
              {canWrite && (
                <button className="link" onClick={() => setEditing(n)}>
                  Edit
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {editing && (
        <NoticeForm
          notice={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </>
  )
}

/* ---------------- Page ---------------- */

export default function Events({ role, initialTab }) {
  const [section, setSection] = useState(initialTab === 'notices' ? 'notices' : 'events')
  return (
    <div className="page">
      <h1 className="page-title">Events &amp; Notices</h1>
      <div className="seg wide-seg tabs-top" role="tablist">
        <button role="tab" aria-selected={section === 'events'} className={section === 'events' ? 'on' : ''} onClick={() => setSection('events')}>
          Events
        </button>
        <button role="tab" aria-selected={section === 'notices'} className={section === 'notices' ? 'on' : ''} onClick={() => setSection('notices')}>
          Notices
        </button>
      </div>
      {section === 'events' ? <EventsList role={role} /> : <Notices role={role} />}
    </div>
  )
}
