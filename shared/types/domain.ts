// Domain types shared by the Vue app and the Nitro server. Money is always an integer in minor
// units (pesewas / cents); dates are ISO `YYYY-MM-DD`, timestamps full ISO strings.

export const ROLES = [
  'admin',
  'manager',
  'sales',
  'finance',
  'viewer',
] as const
export type Role = typeof ROLES[number]

export const MEMBER_STATUSES = ['active', 'invited', 'suspended'] as const
export type MemberStatus = typeof MEMBER_STATUSES[number]

export const INVOICE_TEMPLATES = ['ledger', 'bold', 'minimal'] as const
export type InvoiceTemplate = typeof INVOICE_TEMPLATES[number]

export const CUSTOMER_STAGES = [
  'active',
  'lead',
  'at_risk',
  'inactive',
] as const
export type CustomerStage = typeof CUSTOMER_STAGES[number]

/** Stored invoice states. `overdue` is derived: a sent invoice past its due date. */
export const STORED_INVOICE_STATUSES = ['draft', 'sent', 'paid'] as const
export const INVOICE_STATUSES = ['draft', 'sent', 'overdue', 'paid'] as const
export type InvoiceStatus = typeof INVOICE_STATUSES[number]

export const CURRENCIES = [
  { code: 'GHS', name: 'Ghana cedi' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
] as const
export type Currency = typeof CURRENCIES[number]['code']

export const PAYMENT_TERMS = [0, 7, 14, 30, 45, 60] as const

export const PAYMENT_METHODS = [
  'bank_transfer',
  'mobile_money',
  'cash',
  'cheque',
  'card',
] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]

export interface AccountSummary {
  id: string
  name: string
  mark: string
  color: string
  legalName: string
}

export interface Account extends AccountSummary {
  taxId: string
  address: string
  email: string
  phone: string
  logoUrl: string | null
  logoLightUrl: string | null
  numberPrefix: string
  nextNumber: number
  numberPadding: number
  currency: Currency
  paymentTermsDays: number
  defaultTaxRate: number
  paymentDetails: string
  invoiceNotes: string
  defaultTemplate: InvoiceTemplate
  isPrimary: boolean
  stats: { customers: number, invoices: number }
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  title: string
  avatarColor: string
  /** Accounts this person can work in. Admins always get every account. */
  accountIds: string[]
}

export interface Member {
  id: string
  name: string
  title: string
  email: string
  phone: string
  role: Role
  status: MemberStatus
  avatarColor: string
  accountIds: string[]
  createdAt: string
  lastLoginAt: string | null
}

export interface Customer {
  id: string
  accountId: string
  name: string
  industry: string
  contactName: string
  contactRole: string
  email: string
  phone: string
  address: string
  stage: CustomerStage
  ownerId: string | null
  ownerName: string | null
  paymentTermsDays: number | null
  tags: string[]
  createdAt: string
  lastActivity: string | null
  lastActivityAt: string | null
  /** Unpaid balance on sent invoices, minor units. */
  outstanding: number
}

export interface CustomerDetail extends Customer {
  lifetimeBilled: number
  activities: Activity[]
}

export type ActivityType = 'note' | 'call' | 'invoice_created' | 'invoice_sent' | 'payment' | 'customer_created' | 'customer_updated'

export interface Activity {
  id: string
  type: ActivityType
  body: string
  userName: string | null
  createdAt: string
}

export interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  /** Unit price, minor units. */
  rate: number
  /** quantity × rate, rounded, minor units. */
  amount: number
}

export interface InvoiceListItem {
  id: string
  accountId: string
  customerId: string | null
  customerName: string | null
  number: string
  status: InvoiceStatus
  template: InvoiceTemplate
  currency: Currency
  issueDate: string | null
  dueDate: string | null
  total: number
  amountPaid: number
}

export interface Payment {
  id: string
  amount: number
  method: PaymentMethod
  reference: string
  paidAt: string
  recordedBy: string | null
}

export interface InvoiceCustomer {
  id: string
  name: string
  contactName: string
  address: string
  email: string
}

export interface Invoice extends InvoiceListItem {
  notes: string
  taxRate: number
  subtotal: number
  tax: number
  sentAt: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
  items: InvoiceItem[]
  payments: Payment[]
  account: Account
  customer: InvoiceCustomer | null
}

export interface Task {
  id: string
  accountId: string
  customerId: string | null
  invoiceId: string | null
  title: string
  dueDate: string | null
  done: boolean
}

export interface FollowUp {
  id: string
  title: string
  meta: string
  tone: 'urgent' | 'normal' | 'quiet'
  /** Present for manual tasks, which can be ticked off. */
  taskId?: string
  invoiceId?: string
}

export interface DashboardData {
  account: AccountSummary
  kpis: { label: string, value: number, money: boolean, note: string }[]
  recentInvoices: InvoiceListItem[]
  chart: { month: string, invoiced: number, collected: number }[]
  followUps: FollowUp[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
