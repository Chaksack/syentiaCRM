import { z } from 'zod'
import {
  ADJUSTMENT_KINDS,
  BILLING_CYCLES,
  CUSTOMER_STAGES,
  INVOICE_TEMPLATES,
  MEMBER_STATUSES,
  PAYMENT_METHODS,
  PROJECT_STATUSES,
  ROLES,
} from '../types/domain'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #26251e')
const currency = z.enum(['GHS', 'USD', 'EUR', 'GBP'])
const trimmed = (max: number) => z.string().trim().max(max)

type WithoutDefaults<T extends z.ZodRawShape> = { [K in keyof T]: T[K] extends z.ZodDefault<infer Inner> ? Inner : T[K] }

/**
 * `.partial()` for PATCH bodies: every field optional and none defaulted, so a request changes only
 * the fields it sends. (Plain `.partial()` isn't enough in Zod 4 — it still fills in each field's
 * default, which would blank whatever the request left out.)
 */
function partialUpdate<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(Object.entries(schema.shape).map(([key, field]) => [
    key,
    field instanceof z.ZodDefault
      ? field.unwrap()
      : field,
  ])) as WithoutDefaults<T>
  return z.object(shape).partial()
}

export const adjustmentSchema = z.object({
  kind: z.enum(ADJUSTMENT_KINDS),
  label: trimmed(60),
  mode: z.enum(['percent', 'fixed']),
  value: z.coerce.number().min(0, 'Adjustments can’t be negative'),
}).refine(a => a.mode === 'fixed' || a.value <= 100, {
  message: 'A percentage can’t be more than 100%',
  path: ['value'],
})
const adjustments = z.array(adjustmentSchema).max(20)

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Use at least 8 characters').max(200),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters for the new password').max(200),
})

export const accountSchema = z.object({
  name: trimmed(80).min(1, 'Give the account a name'),
  mark: trimmed(3).min(1, 'Use 1–3 characters').transform(v => v.toUpperCase()),
  legalName: trimmed(160),
  taxId: trimmed(60),
  address: trimmed(300),
  email: trimmed(160),
  phone: trimmed(60),
  color: hexColor,
  numberPrefix: trimmed(20),
  nextNumber: z.coerce.number().int().min(1).max(99_999_999),
  numberPadding: z.coerce.number().int().min(1).max(8).default(4),
  currency,
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  defaultAdjustments: adjustments.default([]),
  paymentDetails: trimmed(1000),
  invoiceNotes: trimmed(1000),
  defaultTemplate: z.enum(INVOICE_TEMPLATES),
})
export type AccountInput = z.infer<typeof accountSchema>

export const customerSchema = z.object({
  accountId: z.string().min(1),
  name: trimmed(160).min(1, 'Enter the customer’s name'),
  industry: trimmed(80).default(''),
  contactName: trimmed(120).default(''),
  contactRole: trimmed(120).default(''),
  email: z.union([
    z.literal(''),
    z.string().trim().toLowerCase().email('Enter a valid email address'),
  ]).default(''),
  phone: trimmed(60).default(''),
  address: trimmed(300).default(''),
  stage: z.enum(CUSTOMER_STAGES).default('lead'),
  ownerId: z.string().nullable().default(null),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).nullable().default(null),
  tags: z.array(trimmed(40).min(1)).max(20).default([]),
})
export type CustomerInput = z.infer<typeof customerSchema>

export const customerUpdateSchema = partialUpdate(customerSchema.omit({ accountId: true }))

export const noteSchema = z.object({
  type: z.enum(['note', 'call']).default('note'),
  body: trimmed(4000).min(1, 'Write something first'),
})

export const invoiceItemSchema = z.object({
  description: trimmed(500),
  quantity: z.coerce.number().min(0).max(1_000_000),
  rate: z.coerce.number().int().min(0).max(1_000_000_000_00),
})

export const invoiceCreateSchema = z.object({
  accountId: z.string().min(1),
  customerId: z.string().nullable().optional(),
})

export const invoiceUpdateSchema = z.object({
  accountId: z.string().min(1),
  customerId: z.string().nullable(),
  currency,
  issueDate: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  template: z.enum(INVOICE_TEMPLATES),
  notes: trimmed(2000),
  adjustments,
  items: z.array(invoiceItemSchema).max(200),
}).partial()
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>

export const paymentSchema = z.object({
  amount: z.coerce.number().int().positive('Enter the amount received'),
  method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  reference: trimmed(120).default(''),
  paidAt: isoDate,
})

export const inviteSchema = z.object({
  name: trimmed(120).min(1, 'Enter the staff member’s full name.'),
  title: trimmed(120).default(''),
  email: z.string().trim().toLowerCase().email('Enter a valid work email address.'),
  phone: trimmed(60).default(''),
  role: z.enum(ROLES),
  accountIds: z.array(z.string()).default([]),
}).refine(v => v.role === 'admin' || v.accountIds.length > 0, {
  message: 'Give access to at least one account.',
  path: ['accountIds'],
})
export type InviteInput = z.infer<typeof inviteSchema>

export const memberUpdateSchema = z.object({
  name: trimmed(120).min(1),
  title: trimmed(120),
  phone: trimmed(60),
  role: z.enum(ROLES),
  status: z.enum(MEMBER_STATUSES),
  accountIds: z.array(z.string()),
}).partial()

export const taskSchema = z.object({
  accountId: z.string().min(1),
  title: trimmed(300).min(1, 'Describe the follow-up'),
  dueDate: isoDate.nullable().default(null),
  customerId: z.string().nullable().default(null),
})

export const taskUpdateSchema = z.object({
  done: z.boolean(),
})

const money = z.coerce.number().int('Enter an amount').min(0, 'Amounts can’t be negative').max(1_000_000_000_00)

const licenseFields = z.object({
  accountId: z.string().min(1),
  customerId: z.string().nullable().default(null),
  name: trimmed(160).min(1, 'Name the licence'),
  issuer: trimmed(160).default(''),
  reference: trimmed(160).default(''),
  startDate: isoDate.nullable().default(null),
  renewalDate: isoDate.nullable().default(null),
  cycle: z.enum(BILLING_CYCLES).default('yearly'),
  cost: money.default(0),
  currency,
  autoRenew: z.boolean().default(false),
  cancelled: z.boolean().default(false),
  notes: trimmed(2000).default(''),
})
const renewalAfterStart = {
  check: (l: { startDate: string | null, renewalDate: string | null }) => !l.startDate || !l.renewalDate || l.startDate <= l.renewalDate,
  error: {
    message: 'The renewal date can’t be before the start date',
    path: ['renewalDate'],
  },
}
export const licenseSchema = licenseFields.refine(renewalAfterStart.check, renewalAfterStart.error)
export type LicenseInput = z.infer<typeof licenseSchema>

// Updates take the whole record (not .partial(): in Zod 4 a partial schema still fills in defaults,
// which would blank any field the request left out).
export const licenseUpdateSchema = licenseFields.omit({ accountId: true }).refine(renewalAfterStart.check, renewalAfterStart.error)

export const projectCostSchema = z.object({
  label: trimmed(160).min(1, 'Describe each recurring cost'),
  amount: money,
  frequency: z.enum(BILLING_CYCLES),
  nextDueDate: isoDate.nullable().default(null),
})

const projectFields = z.object({
  accountId: z.string().min(1),
  customerId: z.string().min(1, 'Choose the customer'),
  name: trimmed(160).min(1, 'Name the project'),
  description: trimmed(4000).default(''),
  status: z.enum(PROJECT_STATUSES).default('active'),
  startDate: isoDate.nullable().default(null),
  endDate: isoDate.nullable().default(null),
  ownerId: z.string().nullable().default(null),
  currency,
  costs: z.array(projectCostSchema).max(50).default([]),
})
const endAfterStart = {
  check: (p: { startDate: string | null, endDate: string | null }) => !p.startDate || !p.endDate || p.startDate <= p.endDate,
  error: {
    message: 'The end date can’t be before the start date',
    path: ['endDate'],
  },
}
export const projectSchema = projectFields.refine(endAfterStart.check, endAfterStart.error)
export type ProjectInput = z.infer<typeof projectSchema>

/** Updates take the whole record, like licenseUpdateSchema. */
export const projectUpdateSchema = projectFields.omit({ accountId: true }).refine(endAfterStart.check, endAfterStart.error)
