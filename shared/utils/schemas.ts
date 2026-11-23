import { z } from 'zod'
import {
  CUSTOMER_STAGES,
  INVOICE_TEMPLATES,
  MEMBER_STATUSES,
  PAYMENT_METHODS,
  ROLES,
} from '../types/domain'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #26251e')
const currency = z.enum(['GHS', 'USD', 'EUR', 'GBP'])
const trimmed = (max: number) => z.string().trim().max(max)

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Use at least 8 characters').max(200),
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
  defaultTaxRate: z.coerce.number().min(0).max(100),
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

export const customerUpdateSchema = customerSchema.omit({ accountId: true }).partial()

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
  taxRate: z.coerce.number().min(0).max(100),
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
