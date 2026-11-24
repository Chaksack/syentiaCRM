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
  { code: 'GBP', name: 'British pound' },
  { code: 'EUR', name: 'Euro' },
] as const
export type Currency = typeof CURRENCIES[number]['code']

export const PAYMENT_TERMS = [0, 7, 14, 30, 45, 60] as const

/** How often a licence fee or project cost recurs. */
export const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly'] as const
export type BillingCycle = typeof BILLING_CYCLES[number]

/**
 * Stored licences are either live or cancelled; the rest is derived from the renewal date:
 * `due_soon` within RENEWAL_WINDOW_DAYS, `expired` once it has passed.
 */
export const LICENSE_STATUSES = [
  'active',
  'due_soon',
  'expired',
  'cancelled',
] as const
export type LicenseStatus = typeof LICENSE_STATUSES[number]

export const PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
  'completed',
] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

export const PAYMENT_METHODS = [
  'bank_transfer',
  'mobile_money',
  'cash',
  'cheque',
  'card',
] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]

/**
 * Adjustments applied after the line items, in this order: discounts reduce the subtotal; taxes
 * and levies are charged on the discounted amount; deductions (e.g. withholding tax) come off the
 * total and leave the amount the customer actually pays.
 */
export const ADJUSTMENT_KINDS = ['discount', 'tax', 'deduction'] as const
export type AdjustmentKind = typeof ADJUSTMENT_KINDS[number]

export interface Adjustment {
  kind: AdjustmentKind
  label: string
  mode: 'percent' | 'fixed'
  /** A percentage (15 = 15%) or, for `fixed`, an amount in minor units. */
  value: number
}

export interface AdjustmentLine extends Adjustment {
  /** What this adjustment comes to on this invoice, minor units (always positive). */
  amount: number
}

export interface InvoiceBreakdown {
  subtotal: number
  lines: AdjustmentLine[]
  discount: number
  /** Subtotal less discounts — the base taxes and deductions are worked out on. */
  net: number
  tax: number
  /** Net plus taxes and levies. */
  total: number
  deductions: number
  /** Total less deductions: what the customer pays. */
  payable: number
}

export interface AccountSummary {
  id: string
  name: string
  mark: string
  color: string
  legalName: string
  currency: Currency
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
  /** Copied onto every new invoice from this account (e.g. NHIL, GETFund levy, VAT). */
  defaultAdjustments: Adjustment[]
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
  projects: Project[]
  licenses: License[]
}

export type ActivityType = 'note' | 'call' | 'invoice_created' | 'invoice_sent' | 'payment' | 'customer_created' | 'customer_updated'
  | 'project_created' | 'project_updated' | 'license_created' | 'license_renewed'

/**
 * A licence, permit or subscription with a renewal date. With no customer it is one the company
 * itself holds (a business permit, a software subscription); with one, it is held for or issued
 * to that customer.
 */
export interface License {
  id: string
  accountId: string
  customerId: string | null
  customerName: string | null
  name: string
  /** Who issues it: a vendor, regulator or authority. */
  issuer: string
  /** Licence number, key or certificate reference. */
  reference: string
  startDate: string | null
  /** Next renewal / expiry date; null for a licence that doesn't expire. */
  renewalDate: string | null
  cycle: BillingCycle
  /** Fee per cycle, minor units. */
  cost: number
  currency: Currency
  autoRenew: boolean
  notes: string
  status: LicenseStatus
  createdAt: string
  updatedAt: string
}

export interface ProjectCost {
  id?: string
  label: string
  /** Per cycle, minor units. */
  amount: number
  frequency: BillingCycle
  /** When this cost next falls due, if tracked. */
  nextDueDate: string | null
}

export interface Project {
  id: string
  accountId: string
  customerId: string
  customerName: string
  name: string
  description: string
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  ownerId: string | null
  ownerName: string | null
  currency: Currency
  costs: ProjectCost[]
  /** All recurring costs as a monthly figure, minor units. */
  monthlyCost: number
  /** Earliest next-due date across the costs. */
  nextDueDate: string | null
  createdAt: string
  updatedAt: string
}

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
  adjustments: Adjustment[]
  /** Subtotal, each adjustment's amount, and what's payable — `total` on the list item equals `breakdown.payable`. */
  breakdown: InvoiceBreakdown
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
  /** Where the title links to, if anywhere. */
  href?: string
}

export interface DashboardData {
  account: AccountSummary
  /** Invoice details the account hasn't filled in yet (shown to admins as a setup prompt). */
  setupMissing: string[]
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
