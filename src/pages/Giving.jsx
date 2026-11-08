import { useCallback, useEffect, useState } from 'react'
import { supabase, CHURCH_NAME } from '../supabase'
import { Modal, Field, Spinner, Empty, useToast } from '../ui'
import MemberPicker from '../MemberPicker'
import { money, fmtDate, todayISO, label } from '../utils'

// Everything that is not a tithe is grouped under "Offering"
const OFFERING_TYPES = ['offering', 'thanksgiving', 'building_fund', 'missions', 'pledge_payment', 'other']
const METHODS = ['cash', 'mpesa', 'bank', 'cheque', 'other']
const JOIN = '*, members(full_name, member_no)'

function periodRange(period) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  if (period === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 1))]
  if (period === 'last') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 1))]
  if (period === 'year') return [`${y}-01-01`, `${y + 1}-01-01`]
  return [null, null]
}

function GiveForm({ kind, members, onSaved, onClose }) {
  const toast = useToast()
  const isTithe = kind === 'tithe'
  const [form, setForm] = useState({
    member_id: '',
    giving_type: isTithe ? 'tithe' : 'offering',
    amount: '',
    payment_method: 'cash',
    reference: '',
    giving_date: todayISO(),
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    if (isTithe && !form.member_id) return toast('Choose the member who is giving the tithe', 'err')
    setBusy(true)
    const payload = {
      ...form,
      amount: Number(form.amount),
      member_id: form.member_id || null,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    }
    const { data, error } = await supabase.from('giving').insert(payload).select(JOIN).single()
    setBusy(false)
    if (error) return toast(error.message, 'err')
    toast(isTithe ? 'Tithe recorded' : 'Offering recorded')
    onSaved(data)
  }

  return (
    <Modal
      title={isTithe ? 'Record tithe' : 'Record offering'}
      onClose={onClose}
      footer={
        <button type="submit" form="give-form" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save and get receipt'}
        </button>
      }
    >
      <form id="give-form" onSubmit={save} className="grid">
        <div className="field wide">
          <span>{isTithe ? 'Member' : 'Member (optional)'}</span>
          <MemberPicker
            members={members}
            value={form.member_id}
            onChange={(v) => setForm((f) => ({ ...f, member_id: v }))}
            hint={isTithe ? undefined : 'Leave empty for anonymous or general offering.'}
          />
        </div>
        {!isTithe && (
          <Field label="Kind of offering" wide>
            <select value={form.giving_type} onChange={set('giving_type')}>
              {OFFERING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Amount (KES)">
          <input type="number" inputMode="decimal" min="1" step="any" value={form.amount} onChange={set('amount')} required />
        </Field>
        <Field label="Paid by">
          <select value={form.payment_method} onChange={set('payment_method')}>
            {METHODS.map((t) => (
              <option key={t} value={t}>
                {t === 'mpesa' ? 'M-Pesa' : label(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={form.giving_date} onChange={set('giving_date')} required />
        </Field>
        <Field label="Reference (M-Pesa code)">
          <input value={form.reference} onChange={set('reference')} />
        </Field>
        <Field label="Notes" wide>
          <input value={form.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

function Receipt({ row, canDelete, onClose, onDeleted }) {
  const toast = useToast()
  const who = row.members?.full_name || 'Anonymous'
  const text = [
    `${CHURCH_NAME}`,
    `Receipt ${row.receipt_no}`,
    `Date: ${fmtDate(row.giving_date)}`,
    `Received from: ${who}`,
    `For: ${label(row.giving_type)}`,
    `Amount: ${money(row.amount)}`,
    `Paid by: ${row.payment_method === 'mpesa' ? 'M-Pesa' : label(row.payment_method)}${row.reference ? ` (${row.reference})` : ''}`,
    'God bless you.',
  ].join('\n')

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Receipt copied')
      }
    } catch {
      /* cancelled */
    }
  }
  const remove = async () => {
    if (!window.confirm(`Delete receipt ${row.receipt_no}?`)) return
    const { error } = await supabase.from('giving').delete().eq('id', row.id)
    if (error) return toast(error.message, 'err')
    toast('Entry deleted')
    onDeleted()
  }

  return (
    <Modal
      title="Receipt"
      onClose={onClose}
      footer={
        <>
          {canDelete && (
            <button className="btn danger ghost" onClick={remove}>
              Delete
            </button>
          )}
          <button className="btn" onClick={share}>
            Share receipt
          </button>
        </>
      }
    >
      <div className="receipt">
        <small>{CHURCH_NAME}</small>
        <div className="receipt-amount">{money(row.amount)}</div>
        <dl>
          <dt>Receipt no.</dt>
          <dd>{row.receipt_no}</dd>
          <dt>Date</dt>
          <dd>{fmtDate(row.giving_date)}</dd>
          <dt>From</dt>
          <dd>{who}</dd>
          <dt>For</dt>
          <dd>{label(row.giving_type)}</dd>
          <dt>Paid by</dt>
          <dd>
            {row.payment_method === 'mpesa' ? 'M-Pesa' : label(row.payment_method)}
            {row.reference ? ` (${row.reference})` : ''}
          </dd>
          {row.notes && (
            <>
              <dt>Notes</dt>
              <dd>{row.notes}</dd>
            </>
          )}
        </dl>
      </div>
    </Modal>
  )
}

export default function Giving({ role }) {
  const toast = useToast()
  const isMember = role === 'member'
  const canDelete = role === 'admin'
  const [kind, setKind] = useState('tithe') // tithe | offering
  const [rows, setRows] = useState(null)
  const [members, setMembers] = useState([])
  const [period, setPeriod] = useState(isMember ? 'year' : 'month')
  const [offeringType, setOfferingType] = useState('all')
  const [adding, setAdding] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const load = useCallback(async () => {
    const [start, end] = periodRange(period)
    let q = supabase
      .from('giving')
      .select(JOIN)
      .order('giving_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000)
    if (start) q = q.gte('giving_date', start).lt('giving_date', end)
    if (kind === 'tithe') q = q.eq('giving_type', 'tithe')
    else if (offeringType !== 'all') q = q.eq('giving_type', offeringType)
    else q = q.neq('giving_type', 'tithe')
    const { data, error } = await q
    if (error) toast(error.message, 'err')
    else setRows(data)
  }, [period, kind, offeringType, toast])

  useEffect(() => {
    setRows(null)
    load()
  }, [load])

  useEffect(() => {
    if (isMember) return
    supabase
      .from('members')
      .select('id,full_name,phone,member_no')
      .order('full_name')
      .limit(5000)
      .then(({ data }) => setMembers(data || []))
  }, [isMember])

  const total = (rows || []).reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{isMember ? 'My giving' : 'Giving'}</h1>
        {!isMember && (
          <div className="actions">
            <button className="btn" onClick={() => setAdding(true)}>
              {kind === 'tithe' ? 'Record tithe' : 'Record offering'}
            </button>
          </div>
        )}
      </div>

      <div className="seg wide-seg tabs-top" role="tablist">
        <button role="tab" aria-selected={kind === 'tithe'} className={kind === 'tithe' ? 'on' : ''} onClick={() => setKind('tithe')}>
          Tithe
        </button>
        <button role="tab" aria-selected={kind === 'offering'} className={kind === 'offering' ? 'on' : ''} onClick={() => setKind('offering')}>
          Offering
        </button>
      </div>

      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          <option value="month">This month</option>
          <option value="last">Last month</option>
          <option value="year">This year</option>
          <option value="all">All time</option>
        </select>
        {kind === 'offering' && (
          <select value={offeringType} onChange={(e) => setOfferingType(e.target.value)} aria-label="Kind of offering">
            <option value="all">All offerings</option>
            {OFFERING_TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        )}
      </div>

      {!rows ? (
        <Spinner />
      ) : (
        <>
          <div className={`total-bar ${kind}`}>
            <span>
              {kind === 'tithe' ? 'Tithe' : 'Offering'}  |  {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            </span>
            <strong>{money(total)}</strong>
          </div>
          {rows.length === 0 ? (
            <Empty
              title={kind === 'tithe' ? 'No tithe recorded' : 'No offering recorded'}
              hint="Entries for this period will show here."
            />
          ) : (
            <ul className="rows">
              {rows.map((r) => (
                <li key={r.id}>
                  <button className="row" onClick={() => setReceipt(r)}>
                    <span className="row-main">
                      <strong>{isMember ? label(r.giving_type) : r.members?.full_name || 'Anonymous'}</strong>
                      <small>
                        {isMember ? '' : `${label(r.giving_type)}  |  `}
                        {fmtDate(r.giving_date)}  |  {r.receipt_no}
                      </small>
                    </span>
                    <span className="amount">{money(r.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {adding && (
        <GiveForm
          kind={kind}
          members={members}
          onClose={() => setAdding(false)}
          onSaved={(row) => {
            setAdding(false)
            setReceipt(row)
            load()
          }}
        />
      )}
      {receipt && (
        <Receipt
          row={receipt}
          canDelete={canDelete}
          onClose={() => setReceipt(null)}
          onDeleted={() => {
            setReceipt(null)
            load()
          }}
        />
      )}
    </div>
  )
}
