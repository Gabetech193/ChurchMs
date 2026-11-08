export const money = (n) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(Number(n || 0))

export const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(d.length === 10 ? d + 'T00:00:00' : d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const todayISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

export const label = (s = '') => {
  const t = s.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Turns 0712345678, +254712345678, 712345678 ... into 254712345678
export const normalizePhone = (p = '') => {
  const d = String(p).replace(/\D/g, '')
  if (d.startsWith('254')) return d
  if (d.startsWith('0')) return '254' + d.slice(1)
  if (d.length === 9) return '254' + d
  return d
}
export const validPhone = (p) => /^254\d{9}$/.test(normalizePhone(p))
// Members log in with their phone number; behind the scenes it is stored as an email-style id
export const memberEmail = (p) => `${normalizePhone(p)}@member.gabetech.app`

export const fmtShort = (d) =>
  d
    ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : ''
