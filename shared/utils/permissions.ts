import type { Role } from '../types/domain'

export type Permission
  = | 'view'
    | 'customers.write'
    | 'invoices.write'
    | 'invoices.send'
    | 'admin'

/** Single source of truth for who can do what — enforced by the API, mirrored in the UI. */
export const PERMISSION_MATRIX: Record<Permission, readonly Role[]> = {
  'view': [
    'admin',
    'manager',
    'sales',
    'finance',
    'viewer',
  ],
  'customers.write': ['admin', 'manager', 'sales'],
  'invoices.write': ['admin', 'manager', 'sales', 'finance'],
  'invoices.send': ['admin', 'manager', 'finance'],
  'admin': ['admin'],
}

export const PERMISSION_LABELS: { permission: Permission, label: string }[] = [
  { permission: 'view', label: 'View customers & invoices' },
  { permission: 'customers.write', label: 'Add & edit customers' },
  { permission: 'invoices.write', label: 'Create & edit invoices' },
  { permission: 'invoices.send', label: 'Send invoices & record payments' },
  { permission: 'admin', label: 'Manage accounts, branding & team' },
]

export const ROLE_INFO: Record<Role, { name: string, description: string }> = {
  admin: { name: 'Admin', description: 'Everything, including accounts, branding, billing and team.' },
  manager: { name: 'Manager', description: 'Customers and invoices in assigned accounts; approves and sends.' },
  sales: { name: 'Sales', description: 'Manages customers and drafts invoices; cannot send or record payments.' },
  finance: { name: 'Finance', description: 'Sends invoices, records payments and exports reports.' },
  viewer: { name: 'Viewer', description: 'Read-only access to customers and invoices.' },
}

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return !!role && PERMISSION_MATRIX[permission].includes(role)
}
