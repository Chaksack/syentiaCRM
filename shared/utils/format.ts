import type { CustomerStage, InvoiceItem, InvoiceStatus, InvoiceTemplate, PaymentMethod } from '../types/domain'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** 1240000 → "12,400.00"; with a currency → "GHS 12,400.00". */
export function formatMoney(minor: number, currency?: string): string {
  const value = (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency
    ? `${currency} ${value}`
    : value
}

/** "12,400.5" / "12400.50" → 1240050. Returns NaN for anything that isn't a number. */
export function parseMoney(input: string | number): number {
  if (typeof input === 'number')
    return Math.round(input * 100)
  const cleaned = input.replace(/[,\s]/g, '')
  if (!cleaned)
    return 0
  return /^-?\d*(?:\.\d*)?$/.test(cleaned)
    ? Math.round(Number.parseFloat(cleaned) * 100)
    : Number.NaN
}

export function lineAmount(quantity: number, rate: number): number {
  return Math.round(quantity * rate)
}

export function invoiceTotals(items: Pick<InvoiceItem, 'quantity' | 'rate'>[], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + lineAmount(item.quantity, item.rate), 0)
  const tax = Math.round(subtotal * taxRate / 100)
  return { subtotal, tax, total: subtotal + tax }
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return toIsoDate(new Date(y, m - 1, d + days))
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number) as [number, number, number]
  const [y2, m2, d2] = toIso.split('-').map(Number) as [number, number, number]
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** "2026-11-23" → "23 Nov 2026" (or "23 November 2026" when long). */
export function formatDate(iso: string | null | undefined, style: 'short' | 'long' | 'day' = 'short'): string {
  if (!iso)
    return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  const day = String(d).padStart(2, '0')
  if (style === 'day')
    return `${day} ${MONTHS[m - 1]}`
  return `${day} ${(style === 'long'
    ? MONTHS_LONG
    : MONTHS)[m - 1]} ${y}`
}

export function monthLabel(index: number): string {
  return MONTHS[index] ?? ''
}

export function monthLong(index: number): string {
  return MONTHS_LONG[index] ?? ''
}

/** "Today", "2 days ago", "last week", "3 months" — for activity columns. */
export function relativeTime(isoTimestamp: string | null | undefined, now = new Date()): string {
  if (!isoTimestamp)
    return '—'
  const days = daysBetween(isoTimestamp.slice(0, 10), toIsoDate(now))
  if (days <= 0)
    return 'today'
  if (days === 1)
    return 'yesterday'
  if (days < 7)
    return `${days} days ago`
  if (days < 14)
    return 'last week'
  if (days < 30)
    return `${Math.floor(days / 7)} weeks ago`
  const months = Math.floor(days / 30)
  return months <= 1
    ? 'last month'
    : `${months} months ago`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function formatInvoiceNumber(prefix: string, next: number, padding: number): string {
  return `${prefix}${String(next).padStart(padding, '0')}`
}

export function termsLabel(days: number): string {
  return days === 0
    ? 'Due on receipt'
    : `Net ${days}`
}

export const STATUS_STYLE: Record<InvoiceStatus, { label: string, bg: string, fg: string }> = {
  paid: { label: 'Paid', bg: '#e1e9dc', fg: '#2c5527' },
  sent: { label: 'Sent', bg: '#e6e5e0', fg: '#26251e' },
  overdue: { label: 'Overdue', bg: '#fbe1d3', fg: '#9c3600' },
  draft: { label: 'Draft', bg: '#f2f2ef', fg: '#5c5b56' },
}

export const STAGE_STYLE: Record<CustomerStage, { label: string, bg: string, fg: string }> = {
  active: { label: 'Active', bg: '#e1e9dc', fg: '#2c5527' },
  lead: { label: 'Lead', bg: '#e6e5e0', fg: '#26251e' },
  inactive: { label: 'Inactive', bg: '#f2f2ef', fg: '#5c5b56' },
  at_risk: { label: 'At risk', bg: '#fbe1d3', fg: '#9c3600' },
}

export const TEMPLATE_INFO: Record<InvoiceTemplate, { name: string, tag: string }> = {
  ledger: { name: 'Ledger', tag: 'Classic' },
  bold: { name: 'Bold', tag: 'Colour header' },
  minimal: { name: 'Minimal', tag: 'Quiet' },
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
}

export const AVATAR_COLORS = [
  '#cfcebc',
  '#d9d5cf',
  '#e6e5e0',
  '#b6b9be',
  '#ebeae5',
  '#d6dccf',
]

/** Brand colour presets offered on the Accounts page. */
export const BRAND_COLORS = [
  '#26251e',
  '#2f5d50',
  '#2f4b6e',
  '#7a3b1c',
  '#5b4a7a',
]
