import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { Modal, Spinner, Empty, useToast } from '../ui'
import MemberPicker from '../MemberPicker'
import { initials, normalizePhone } from '../utils'

const ROLES = [
  ['pending', 'Pending (no access)'],
  ['secretary', 'Secretary'],
  ['treasurer', 'Treasurer'],
  ['admin', 'Admin'],
]

/* ---------- Staff accounts (admin only) ---------- */
function StaffList({ me }) {
  const toast = useToast()
  const [rows, setRows] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').neq('role', 'member').order('created_at')
    if (error) toast(error.message, 'err')
    else setRows(data)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const change = async (row, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', row.id)
    if (error) return toast(error.message, 'err')
    toast('Role updated')
    load()
  }

  if (!rows) return <Spinner />

  return (
    <>
      <p className="muted">
        New staff sign up on the Church staff tab and wait here. Give them a role to let them in. Secretaries
        manage members, events and notices; treasurers manage giving.
      </p>
      <ul className="rows">
        {rows.map((r) => (
          <li key={r.id} className="row static">
            <span className="avatar">{initials(r.full_name || '?')}</span>
            <span className="row-main">
              <strong>{r.full_name}</strong>
              <small>{r.id === me.id ? 'You' : r.role === 'pending' ? 'Waiting for a role' : ''}</small>
            </span>
            <select
              value={r.role}
              disabled={r.id === me.id}
              onChange={(e) => change(r, e.target.value)}
              aria-label={`Role for ${r.full_name}`}
            >
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---------- Member accounts (admin + secretary) ---------- */
function LinkModal({ account, members, linkedIds, onClose, onDone }) {
  const toast = useToast()
  const free = useMemo(() => members.filter((m) => !linkedIds.has(m.id)), [members, linkedIds])
  const suggestion = useMemo(
    () => free.find((m) => m.phone && account.phone && normalizePhone(m.phone) === normalizePhone(account.phone)),
    [free, account.phone]
  )
  const [chosen, setChosen] = useState(suggestion?.id || '')
  const [busy, setBusy] = useState(false)

  const link = async (memberId) => {
    const { error } = await supabase.rpc('link_member_account', { p_profile: account.id, p_member: memberId })
    if (error) throw error
  }

  const approve = async () => {
    if (!chosen) return toast('Choose the member record to link', 'err')
    setBusy(true)
    try {
      await link(chosen)
      toast('Account approved')
      onDone()
    } catch (e) {
      toast(e.message, 'err')
    }
    setBusy(false)
  }

  const createAndLink = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('members')
        .insert({ full_name: account.full_name, phone: account.phone || null, status: 'active' })
        .select('id')
        .single()
      if (error) throw error
      await link(data.id)
      toast('New member record created and linked')
      onDone()
    } catch (e) {
      toast(e.message, 'err')
    }
    setBusy(false)
  }

  return (
    <Modal
      title="Approve member account"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={createAndLink} disabled={busy}>
            Create new record
          </button>
          <button className="btn" onClick={approve} disabled={busy}>
            Link and approve
          </button>
        </>
      }
    >
      <p>
        <strong>{account.full_name}</strong>
        <br />
        <span className="muted">{account.phone ? `Phone: ${account.phone}` : 'No phone given'}</span>
      </p>
      {suggestion ? (
        <div className="notice ok">A member record with the same phone number was found and selected below.</div>
      ) : (
        <div className="notice warn">No member has this phone number. Search for the right record, or create a new one.</div>
      )}
      <div className="field" style={{ marginTop: '0.8rem' }}>
        <span>Member record</span>
        <MemberPicker members={free} value={chosen} onChange={setChosen} />
      </div>
      <p className="muted small-print">
        Only link someone you have confirmed is that member. Once linked, they can see that member's giving history.
      </p>
    </Modal>
  )
}

function MemberAccounts() {
  const toast = useToast()
  const [accounts, setAccounts] = useState(null)
  const [members, setMembers] = useState([])
  const [reviewing, setReviewing] = useState(null)

  const load = useCallback(async () => {
    const [a, m] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'member').order('created_at', { ascending: false }),
      supabase.from('members').select('id,full_name,phone,member_no').order('full_name').limit(5000),
    ])
    if (a.error) toast(a.error.message, 'err')
    else setAccounts(a.data)
    setMembers(m.data || [])
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const linkedIds = useMemo(() => new Set((accounts || []).filter((a) => a.member_id).map((a) => a.member_id)), [accounts])
  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  const unlink = async (acct) => {
    if (!window.confirm(`Remove ${acct.full_name}'s access? They can be approved again later.`)) return
    const { error } = await supabase.rpc('link_member_account', { p_profile: acct.id, p_member: null })
    if (error) return toast(error.message, 'err')
    toast('Access removed')
    load()
  }

  if (!accounts) return <Spinner />

  const waiting = accounts.filter((a) => !a.member_id)
  const approved = accounts.filter((a) => a.member_id)

  return (
    <>
      <p className="muted">
        Members create their own account on the Member tab of the login page. Approve each one by linking it to
        their member record.
      </p>

      <h2 className="section-h">Waiting for approval ({waiting.length})</h2>
      {waiting.length === 0 ? (
        <Empty title="No requests waiting" />
      ) : (
        <ul className="rows">
          {waiting.map((a) => (
            <li key={a.id} className="row static">
              <span className="avatar">{initials(a.full_name || '?')}</span>
              <span className="row-main">
                <strong>{a.full_name}</strong>
                <small>{a.phone || 'No phone'}</small>
              </span>
              <button className="btn" onClick={() => setReviewing(a)}>
                Review
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-h">Approved ({approved.length})</h2>
      {approved.length === 0 ? (
        <Empty title="No approved member accounts yet" />
      ) : (
        <ul className="rows">
          {approved.map((a) => (
            <li key={a.id} className="row static">
              <span className="avatar">{initials(a.full_name || '?')}</span>
              <span className="row-main">
                <strong>{a.full_name}</strong>
                <small>
                  {byId[a.member_id] ? `${byId[a.member_id].member_no || ''}  |  ${byId[a.member_id].full_name}` : 'Linked'}
                </small>
              </span>
              <button className="link danger" onClick={() => unlink(a)}>
                Remove access
              </button>
            </li>
          ))}
        </ul>
      )}

      {reviewing && (
        <LinkModal
          account={reviewing}
          members={members}
          linkedIds={linkedIds}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null)
            load()
          }}
        />
      )}
    </>
  )
}

export default function Staff({ me, role }) {
  const isAdmin = role === 'admin'
  const [tab, setTab] = useState(isAdmin ? 'staff' : 'members')

  return (
    <div className="page">
      <h1 className="page-title">Accounts</h1>
      {isAdmin && (
        <div className="seg wide-seg tabs-top" role="tablist">
          <button role="tab" aria-selected={tab === 'staff'} className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>
            Staff
          </button>
          <button role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>
            Member accounts
          </button>
        </div>
      )}
      {tab === 'staff' && isAdmin ? <StaffList me={me} /> : <MemberAccounts />}
    </div>
  )
}
