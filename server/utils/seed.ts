import type { Db } from './db'
import { addDays, invoiceTotals, lineAmount, todayIso } from '#shared/utils/format'
import { newId, nowIso } from './db'
import { hashPassword, randomToken } from './password'

/**
 * First-run setup. Always creates the first admin (from NUXT_SEED_ADMIN_*); unless
 * NUXT_SEED_DEMO=false, also loads the demo accounts, customers and invoices from the design.
 * Runs only when the users table is empty, inside the startup transaction (see initialise in db.ts).
 */
export async function seedDatabase(db: Db) {
  const existing = await db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number | string }
  if (Number(existing.n) > 0)
    return
  await seed(db)
}

async function seed(db: Db) {
  const config = useRuntimeConfig()
  const demo = String(config.seedDemo) !== 'false'
  const today = todayIso()
  const at = (offsetDays: number, time = '10:00:00') => `${addDays(today, offsetDays)}T${time}.000Z`

  let adminPassword = config.seedAdminPassword
  if (!adminPassword) {
    adminPassword = randomToken(9)
    console.warn(`\n[seed] Created admin ${config.seedAdminEmail} with password: ${adminPassword}\n[seed] Set NUXT_SEED_ADMIN_PASSWORD to choose it yourself.\n`)
  }

  // ── Accounts ──
  const A1 = newId('acc')
  const A2 = newId('acc')
  const insertAccount = db.prepare(`
      INSERT INTO accounts (id, name, mark, legal_name, tax_id, address, email, phone, color, number_prefix, next_number,
        number_padding, currency, payment_terms_days, default_tax_rate, payment_details, invoice_notes, default_template, is_primary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4, 'GHS', ?, 0, ?, ?, ?, ?, ?)
    `)
  await insertAccount.run(A1, 'Account 1', 'A1', '[Legal name 1]', '[TIN]', '[Street address], Accra, Ghana', '[billing email]', '[phone]', '#26251e', 'A1-2026-', 1, 30, '[Bank name] · [Account number]\nMobile money: [number]', 'Thank you for your business. Questions about this invoice: [billing email].', 'ledger', 1, at(-400))
  if (demo)
    await insertAccount.run(A2, 'Account 2', 'A2', '[Legal name 2]', '[TIN]', '[Street address], Accra, Ghana', '[billing email]', '[phone]', '#2f5d50', 'A2-INV-', 1, 14, '[Bank name] · [Account number]\nSWIFT [code]', 'Thank you for your business. Please quote the invoice number with your payment.', 'bold', 0, at(-300))

  // ── Users ──
  const adminId = newId('usr')
  await db.prepare(`
      INSERT INTO users (id, name, title, email, role, status, password_hash, avatar_color, created_at)
      VALUES (?, ?, 'Admin', ?, 'admin', 'active', ?, '#cfcebc', ?)
    `).run(adminId, config.seedAdminName, String(config.seedAdminEmail).toLowerCase(), await hashPassword(adminPassword), at(-400))

  if (!demo)
    return

  const staff: [string, string, string, string, string, string[], string][] = [
    [
      'Ama K.',
      'manager',
      'Account manager',
      'ama@syentia.example',
      'active',
      [A1, A2],
      '#d9d5cf',
    ],
    [
      'Kwesi Darko',
      'finance',
      'Accounts officer',
      'kwesi@syentia.example',
      'active',
      [A1],
      '#e6e5e0',
    ],
    [
      'Adjoa Boakye',
      'sales',
      'Sales executive',
      'adjoa@syentia.example',
      'active',
      [A2],
      '#b6b9be',
    ],
    [
      'Selorm Agbeko',
      'viewer',
      'Auditor · external',
      'selorm@audit.example',
      'invited',
      [A1, A2],
      '#ebeae5',
    ],
  ]
  const userIds: Record<string, string> = { 'Andrew C.': adminId }
  for (const [i, [name, role, title, email, status, accounts, color]] of staff.entries()) {
    const id = newId('usr')
    userIds[name] = id
    await db.prepare(`
        INSERT INTO users (id, name, title, email, role, status, invite_token, invite_expires_at, avatar_color, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, title, email, role, status, status === 'invited'
      ? randomToken()
      : null, status === 'invited'
      ? at(7)
      : null, color, at(-200 + i))
    for (const accountId of accounts)
      await db.prepare('INSERT INTO user_accounts (user_id, account_id) VALUES (?, ?)').run(id, accountId)
  }

  // ── Customers ──
  type CustomerSeed = [account: string, name: string, contact: string, role: string, industry: string, stage: string, owner: string, sinceDays: number, tags: string[]]
  const customers: CustomerSeed[] = [
    [
      A1,
      'Volta Freight Co.',
      'Efua Mensah',
      'Finance lead',
      'Logistics',
      'active',
      'Andrew C.',
      -630,
      ['Retainer', 'Priority'],
    ],
    [
      A1,
      'Osu Dental Clinic',
      'Dr. Kwame Boateng',
      'Practice owner',
      'Healthcare',
      'active',
      'Andrew C.',
      -420,
      [],
    ],
    [
      A1,
      'Kumasi Agro Exports',
      'Yaw Owusu',
      'Operations',
      'Agriculture',
      'at_risk',
      'Ama K.',
      -380,
      [],
    ],
    [
      A1,
      'Labadi Hospitality',
      'Abena Asante',
      'General manager',
      'Hospitality',
      'active',
      'Ama K.',
      -300,
      ['Retainer'],
    ],
    [
      A1,
      'Akosombo Solar',
      'Kofi Adjei',
      'Founder',
      'Energy',
      'lead',
      'Andrew C.',
      -20,
      [],
    ],
    [
      A1,
      'Tamale Grain Traders',
      'Fatima Iddrisu',
      'Finance',
      'Agriculture',
      'active',
      'Ama K.',
      -240,
      [],
    ],
    [
      A1,
      'Spintex Print House',
      'Nana Ofori',
      'Director',
      'Printing',
      'lead',
      'Andrew C.',
      -15,
      [],
    ],
    [
      A1,
      'Airport City Motors',
      'Esi Quaye',
      'Procurement',
      'Automotive',
      'inactive',
      'Ama K.',
      -500,
      [],
    ],
    [
      A2,
      'Tema Port Logistics',
      'Kojo Antwi',
      'Finance manager',
      'Logistics',
      'active',
      'Adjoa Boakye',
      -260,
      ['Priority'],
    ],
    [
      A2,
      'Cape Coast Academy',
      'Mrs. Ekua Hagan',
      'Bursar',
      'Education',
      'at_risk',
      'Adjoa Boakye',
      -200,
      [],
    ],
    [
      A2,
      'Accra Fintech Hub',
      'Sena Dzivenu',
      'COO',
      'Financial services',
      'active',
      'Ama K.',
      -180,
      [],
    ],
    [
      A2,
      'Ho Medical Supplies',
      'Elikem Tsikata',
      'Accounts',
      'Healthcare',
      'active',
      'Adjoa Boakye',
      -150,
      [],
    ],
    [
      A2,
      'Takoradi Marine',
      'Ebo Mensah',
      'Managing director',
      'Maritime',
      'active',
      'Adjoa Boakye',
      -6,
      [],
    ],
  ]
  const customerIds: Record<string, string> = {}
  for (const [account, name, contact, role, industry, stage, owner, since, tags] of customers) {
    const id = newId('cus')
    customerIds[name] = id
    const domain = `${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`
    const firstName = contact.replace(/^(Dr\.|Mrs\.)\s*/, '').split(' ')[0]!.toLowerCase()
    await db.prepare(`
        INSERT INTO customers (id, account_id, name, industry, contact_name, contact_role, email, phone, address, stage, owner_id, tags, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, '[Phone number]', '[Customer address]', ?, ?, ?, ?)
      `).run(id, account, name, industry, contact, role, `${firstName}@${domain}`, stage, userIds[owner] ?? null, JSON.stringify(tags), at(since))
  }

  // ── Invoices ──
  type Item = [description: string, quantity: number, rate: number]
  const createInvoice = async (o: {
    account: string
    number: string
    customer: string
    status: 'draft' | 'sent' | 'paid'
    template: string
    issued: number | null
    due: number | null
    items: Item[]
    paidOn?: number
    notes?: string
  }) => {
    const id = newId('inv')
    const items = o.items.map(([description, quantity, rate]) => ({ description, quantity, rate: rate * 100 }))
    const { subtotal, tax, total } = invoiceTotals(items, 0)
    const issueDate = o.issued === null
      ? null
      : addDays(today, o.issued)
    await db.prepare(`
        INSERT INTO invoices (id, account_id, customer_id, number, status, template, currency, issue_date, due_date, notes, tax_rate,
          subtotal, tax, total, amount_paid, sent_at, paid_at, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'GHS', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
      id,
      o.account,
      customerIds[o.customer]!,
      o.number,
      o.status,
      o.template,
      issueDate,
      o.due === null
        ? null
        : addDays(today, o.due),
      o.notes ?? 'Thank you for your business. Please quote the invoice number with your payment.',
      subtotal,
      tax,
      total,
      o.status === 'paid'
        ? total
        : 0,
      o.status === 'draft'
        ? null
        : at(o.issued ?? 0, '09:30:00'),
      o.status === 'paid'
        ? at(o.paidOn ?? 0, '14:00:00')
        : null,
      adminId,
      at(o.issued ?? -1, '09:00:00'),
      at(o.paidOn ?? o.issued ?? -1, '14:00:00'),
    )
    for (const [position, item] of items.entries()) {
      await db.prepare('INSERT INTO invoice_items (id, invoice_id, position, description, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId('itm'), id, position, item.description, item.quantity, item.rate, lineAmount(item.quantity, item.rate))
    }
    if (o.status === 'paid') {
      await db.prepare(`
          INSERT INTO payments (id, invoice_id, account_id, amount, method, reference, paid_at, recorded_by, created_at)
          VALUES (?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?)
        `).run(newId('pay'), id, o.account, total, o.number, addDays(today, o.paidOn ?? 0), adminId, at(o.paidOn ?? 0, '14:00:00'))
    }
    return id
  }

  // History for the "invoiced vs collected" chart — paid invoices over the previous five months.
  const history: Record<string, { prefix: string, start: number, template: string, customers: string[], base: number }> = {
    [A1]: {
      prefix: 'A1-2026-',
      start: 100,
      template: 'ledger',
      customers: [
        'Volta Freight Co.',
        'Osu Dental Clinic',
        'Labadi Hospitality',
        'Tamale Grain Traders',
        'Kumasi Agro Exports',
      ],
      base: 5200,
    },
    [A2]: {
      prefix: 'A2-INV-',
      start: 60,
      template: 'bold',
      customers: [
        'Tema Port Logistics',
        'Accra Fintech Hub',
        'Ho Medical Supplies',
        'Cape Coast Academy',
      ],
      base: 3100,
    },
  }
  for (const [account, h] of Object.entries(history)) {
    let n = h.start
    for (let monthsAgo = 5; monthsAgo >= 1; monthsAgo--) {
      for (let k = 0; k < 4; k++) {
        const issued = -monthsAgo * 30 + k * 6 - 2
        const amount = Math.round(h.base * (0.8 + ((n * 37) % 23) / 30) / 10) * 10
        await createInvoice({
          account,
          number: `${h.prefix}${String(n++).padStart(4, '0')}`,
          customer: h.customers[(n + k) % h.customers.length]!,
          status: 'paid',
          template: h.template,
          issued,
          due: issued + 30,
          paidOn: issued + 12 + ((n * 7) % 10),
          items: [
            ['Managed security services', 1, amount],
          ],
        })
      }
    }
  }

  const volta = await createInvoice({
    account: A1,
    number: 'A1-2026-0142',
    customer: 'Volta Freight Co.',
    status: 'sent',
    template: 'ledger',
    issued: 0,
    due: 7,
    items: [
      ['API security assessment — phase 1', 1, 8500],
      ['Cloud posture monitoring (November)', 1, 2400],
      ['Support hours', 6, 250],
    ],
    notes: 'Thank you for your business. Questions about this invoice: [billing email].',
  })
  await createInvoice({
    account: A1,
    number: 'A1-2026-0141',
    customer: 'Osu Dental Clinic',
    status: 'paid',
    template: 'ledger',
    issued: -2,
    due: 5,
    paidOn: -2,
    items: [
      ['Endpoint protection licences', 10, 250],
      ['Setup & onboarding', 1, 750],
    ],
  })
  await createInvoice({
    account: A1,
    number: 'A1-2026-0140',
    customer: 'Tamale Grain Traders',
    status: 'sent',
    template: 'ledger',
    issued: -4,
    due: 26,
    items: [
      ['Network security review', 1, 4520],
    ],
  })
  const kumasi = await createInvoice({
    account: A1,
    number: 'A1-2026-0139',
    customer: 'Kumasi Agro Exports',
    status: 'sent',
    template: 'ledger',
    issued: -25,
    due: -11,
    items: [
      ['Penetration test — web portal', 1, 5180],
      ['Retest after fixes', 1, 1000],
    ],
  })
  await createInvoice({
    account: A1,
    number: 'A1-2026-0138',
    customer: 'Labadi Hospitality',
    status: 'sent',
    template: 'ledger',
    issued: -18,
    due: 12,
    items: [
      ['Guest Wi-Fi segmentation', 1, 6400],
      ['Staff security training', 1, 2500],
    ],
  })
  await createInvoice({
    account: A1,
    number: 'A1-2026-0137',
    customer: 'Akosombo Solar',
    status: 'draft',
    template: 'ledger',
    issued: null,
    due: null,
    items: [
      ['Security architecture workshop', 1, 2740],
    ],
  })

  await createInvoice({
    account: A2,
    number: 'A2-INV-0087',
    customer: 'Tema Port Logistics',
    status: 'sent',
    template: 'bold',
    issued: -1,
    due: 9,
    items: [
      ['Gateway hardening & rate-limit policy', 1, 6000],
      ['Managed API monitoring (November)', 1, 2400],
      ['Engineering hours', 4, 300],
    ],
  })
  const capeCoast = await createInvoice({
    account: A2,
    number: 'A2-INV-0086',
    customer: 'Cape Coast Academy',
    status: 'sent',
    template: 'bold',
    issued: -15,
    due: -1,
    items: [
      ['Student portal security audit', 1, 4200],
    ],
  })
  await createInvoice({
    account: A2,
    number: 'A2-INV-0085',
    customer: 'Accra Fintech Hub',
    status: 'paid',
    template: 'bold',
    issued: -17,
    due: -3,
    paidOn: -5,
    items: [
      ['API threat modelling', 1, 5375],
    ],
  })
  await createInvoice({
    account: A2,
    number: 'A2-INV-0084',
    customer: 'Ho Medical Supplies',
    status: 'paid',
    template: 'bold',
    issued: -22,
    due: -8,
    paidOn: -9,
    items: [
      ['Backup & recovery review', 1, 2990],
    ],
  })
  await createInvoice({
    account: A2,
    number: 'A2-INV-0083',
    customer: 'Takoradi Marine',
    status: 'draft',
    template: 'bold',
    issued: null,
    due: null,
    items: [
      ['Vessel network assessment', 1, 3450],
    ],
  })

  await db.prepare('UPDATE accounts SET next_number = 143 WHERE id = ?').run(A1)
  await db.prepare('UPDATE accounts SET next_number = 88 WHERE id = ?').run(A2)

  // ── Activity timeline (latest entry becomes each customer's "last activity") ──
  const activity: [account: string, customer: string, type: string, body: string, day: number, invoice?: string][] = [
    [
      A1,
      'Volta Freight Co.',
      'payment',
      'Payment received · GHS 9,200.00',
      -21,
    ],
    [
      A1,
      'Volta Freight Co.',
      'call',
      'Call logged: renewal discussion',
      -5,
    ],
    [
      A1,
      'Volta Freight Co.',
      'invoice_sent',
      'Invoice A1-2026-0142 sent',
      0,
      volta,
    ],
    [
      A1,
      'Osu Dental Clinic',
      'payment',
      'Paid A1-2026-0141',
      -2,
    ],
    [
      A1,
      'Kumasi Agro Exports',
      'note',
      'Reminder sent for A1-2026-0139',
      -3,
      kumasi,
    ],
    [
      A1,
      'Labadi Hospitality',
      'invoice_sent',
      'Invoice A1-2026-0138 sent',
      -18,
    ],
    [
      A1,
      'Akosombo Solar',
      'note',
      'Quote drafted',
      -7,
    ],
    [
      A1,
      'Tamale Grain Traders',
      'call',
      'Call logged: payment timing',
      -8,
    ],
    [
      A1,
      'Spintex Print House',
      'note',
      'Meeting booked',
      -14,
    ],
    [
      A1,
      'Airport City Motors',
      'note',
      'Contract ended',
      -95,
    ],
    [
      A2,
      'Tema Port Logistics',
      'invoice_sent',
      'Invoice A2-INV-0087 sent',
      -1,
    ],
    [
      A2,
      'Cape Coast Academy',
      'invoice_sent',
      'Invoice A2-INV-0086 sent',
      -15,
      capeCoast,
    ],
    [
      A2,
      'Accra Fintech Hub',
      'payment',
      'Paid A2-INV-0085',
      -5,
    ],
    [
      A2,
      'Ho Medical Supplies',
      'payment',
      'Paid A2-INV-0084',
      -9,
    ],
    [
      A2,
      'Takoradi Marine',
      'note',
      'Contract signed · first invoice in draft',
      -6,
    ],
  ]
  for (const [account, customer, type, body, day, invoice] of activity) {
    const createdAt = at(day, '11:00:00')
    const customerId = customerIds[customer]!
    await db.prepare('INSERT INTO activities (id, account_id, customer_id, invoice_id, user_id, type, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(newId('act'), account, customerId, invoice ?? null, adminId, type, body, createdAt)
    await db.prepare('UPDATE customers SET last_activity = ?, last_activity_at = ? WHERE id = ?').run(body, createdAt, customerId)
  }

  // ── Follow-ups ──
  const tasks: [string, string, string | null, number | null][] = [
    [
      A1,
      'Send renewal quote to Volta Freight Co.',
      'Volta Freight Co.',
      4,
    ],
    [
      A1,
      'Call back Osu Dental Clinic',
      'Osu Dental Clinic',
      null,
    ],
    [
      A2,
      'Onboard Takoradi Marine',
      'Takoradi Marine',
      3,
    ],
    [
      A2,
      'Update bank details on Bold template',
      null,
      null,
    ],
  ]
  for (const [account, title, customer, due] of tasks) {
    await db.prepare('INSERT INTO tasks (id, account_id, customer_id, title, due_date, done, created_by, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
      .run(newId('tsk'), account, customer ? customerIds[customer]! : null, title, due === null
        ? null
        : addDays(today, due), adminId, nowIso())
  }
}
