import { useMemo, useState } from 'react'

export default function MemberPicker({ members, value, onChange, hint }) {
  const [q, setQ] = useState('')
  const selected = members.find((m) => m.id === value)
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return members
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(s) ||
          (m.phone || '').includes(s) ||
          (m.member_no || '').toLowerCase().includes(s)
      )
      .slice(0, 6)
  }, [q, members])

  if (selected)
    return (
      <div className="picked">
        <div>
          <strong>{selected.full_name}</strong>
          <small>{[selected.member_no, selected.phone].filter(Boolean).join('  |  ')}</small>
        </div>
        <button type="button" className="link" onClick={() => onChange('')}>
          Change
        </button>
      </div>
    )

  return (
    <div className="picker">
      <input
        placeholder="Search name, phone or member no."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {matches.map((m) => (
        <button
          type="button"
          key={m.id}
          className="pick-row"
          onClick={() => {
            onChange(m.id)
            setQ('')
          }}
        >
          <strong>{m.full_name}</strong>
          <small>{[m.member_no, m.phone].filter(Boolean).join('  |  ')}</small>
        </button>
      ))}
      {!q && hint && <small className="hint">{hint}</small>}
    </div>
  )
}
