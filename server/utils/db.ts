import type { PoolClient } from 'pg'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import pg from 'pg'
import { seedDatabase } from './seed'

type Row = Record<string, any>
type Primitive = string | number | boolean | undefined | null

export interface Statement {
  all: (...params: unknown[]) => Promise<Row[]>
  get: (...params: unknown[]) => Promise<Row | undefined>
  run: (...params: unknown[]) => Promise<{ changes: number }>
}

/**
 * The slice of a SQL client the app uses. Queries use `?` placeholders on both engines; the SQL in
 * server/ sticks to what SQLite and PostgreSQL share.
 */
export interface Db {
  dialect: 'postgresql' | 'sqlite'
  prepare: (sql: string) => Statement
  exec: (sql: string) => Promise<void>
}

// ─── PostgreSQL (Neon) ──────────────────────────────────────────────────────

// BIGINT / COUNT(*) and NUMERIC (SUM of BIGINT) arrive as strings by default; money values fit
// comfortably in a double, so parse them to numbers.
pg.types.setTypeParser(20, Number)
pg.types.setTypeParser(1700, Number.parseFloat)

let pool: pg.Pool | undefined

function databaseUrl(): string {
  return process.env.DATABASE_URL || useRuntimeConfig().databaseUrl || ''
}

function getPool(): pg.Pool {
  if (!pool) {
    // pg treats sslmode=require as verify-full (full certificate check) and warns about it; say so explicitly.
    const url = databaseUrl().replace(/([?&]sslmode=)(?:require|prefer|verify-ca)\b/, '$1verify-full')
    pool = new pg.Pool({
      connectionString: url,
      // Neon's pooler multiplexes these onto server connections, so a handful per instance is plenty.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ...(/[?&]channel_binding=require/.test(url)
        ? { enableChannelBinding: true }
        : {}),
    })
    // Neon drops idle connections when the compute suspends; the pool replaces them on next use.
    pool.on('error', error => console.warn('[db] idle connection closed:', error.message))
  }
  return pool
}

/** `?` → `$1, $2…` (no query in this app puts a literal `?` inside a string). */
function toPg(sql: string): string {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

function pgDb(client: pg.Pool | PoolClient): Db {
  const query = (sql: string, params: unknown[]) => client.query(toPg(sql), params)
  return {
    dialect: 'postgresql',
    prepare: sql => ({
      all: async (...params) => (await query(sql, params)).rows,
      get: async (...params) => (await query(sql, params)).rows[0],
      run: async (...params) => ({ changes: (await query(sql, params)).rowCount ?? 0 }),
    }),
    exec: async (sql) => {
      await client.query(sql)
    },
  }
}

// ─── SQLite (local fallback, via Nitro's db0 + node:sqlite) ─────────────────

function sqliteDb(): Db {
  const db = useDatabase()
  return {
    dialect: 'sqlite',
    prepare: (sql) => {
      const stmt = db.prepare(sql)
      return {
        all: async (...params) => await stmt.all(...params as Primitive[]) as Row[],
        get: async (...params) => await stmt.get(...params as Primitive[]) as Row | undefined,
        run: async (...params) => {
          const res = await stmt.run(...params as Primitive[]) as { changes?: number }
          return {
            changes: Number(res.changes ?? 0),
          }
        },
      }
    },
    exec: async (sql) => {
      await db.exec(sql)
    },
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

let ready: Promise<void> | undefined
let sqliteQueue: Promise<unknown> = Promise.resolve()

function baseDb(): Db {
  return databaseUrl()
    ? pgDb(getPool())
    : sqliteDb()
}

/** The app database, migrated (and seeded on first run) before first use. */
export async function useDb(): Promise<Db> {
  const db = baseDb()
  if (!ready) {
    ready = initialise(db)
      .catch((error) => {
        ready = undefined
        throw error
      })
  }
  await ready
  return db
}

/**
 * Runs `fn` in a transaction, rolling back if it throws. Always query through the `tx` handed to
 * `fn` — on PostgreSQL it is a dedicated pooled connection, so other requests can't interleave.
 */
export async function transaction<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (db.dialect === 'postgresql') {
    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      const result = await fn(pgDb(client))
      await client.query('COMMIT')
      return result
    }
    catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    }
    finally {
      client.release()
    }
  }

  // SQLite has one connection: queue transactions so they never overlap.
  const run = sqliteQueue.then(async () => {
    await db.exec('BEGIN')
    try {
      const result = await fn(db)
      await db.exec('COMMIT')
      return result
    }
    catch (error) {
      await db.exec('ROLLBACK')
      throw error
    }
  })
  sqliteQueue = run.catch(() => {})
  return run
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Migrations and first-run seed in one transaction. On PostgreSQL an advisory lock makes
 * concurrent cold starts (several server instances at once) wait for each other instead of racing.
 */
async function initialise(db: Db) {
  await transaction(db, async (tx) => {
    if (tx.dialect === 'postgresql')
      await tx.exec('SELECT pg_advisory_xact_lock(7342051)')
    await migrate(tx)
    await seedDatabase(tx)
  })
}

async function migrate(db: Db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mark TEXT NOT NULL,
      legal_name TEXT NOT NULL DEFAULT '',
      tax_id TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#26251e',
      logo_key TEXT,
      logo_light_key TEXT,
      number_prefix TEXT NOT NULL DEFAULT '',
      next_number INTEGER NOT NULL DEFAULT 1,
      number_padding INTEGER NOT NULL DEFAULT 4,
      currency TEXT NOT NULL DEFAULT 'GHS',
      payment_terms_days INTEGER NOT NULL DEFAULT 30,
      default_tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
      payment_details TEXT NOT NULL DEFAULT '',
      invoice_notes TEXT NOT NULL DEFAULT '',
      default_template TEXT NOT NULL DEFAULT 'ledger',
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'invited',
      password_hash TEXT,
      invite_token TEXT,
      invite_expires_at TEXT,
      avatar_color TEXT NOT NULL DEFAULT '#cfcebc',
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_accounts (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, account_id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_role TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'lead',
      owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      payment_terms_days INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      last_activity TEXT,
      last_activity_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS customers_account_idx ON customers(account_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      customer_id TEXT REFERENCES customers(id),
      number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      template TEXT NOT NULL DEFAULT 'ledger',
      currency TEXT NOT NULL DEFAULT 'GHS',
      issue_date TEXT,
      due_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
      subtotal BIGINT NOT NULL DEFAULT 0,
      tax BIGINT NOT NULL DEFAULT 0,
      total BIGINT NOT NULL DEFAULT 0,
      amount_paid BIGINT NOT NULL DEFAULT 0,
      sent_at TEXT,
      paid_at TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS invoices_account_idx ON invoices(account_id);
    CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices(customer_id);

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
      rate BIGINT NOT NULL DEFAULT 0,
      amount BIGINT NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items(invoice_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      amount BIGINT NOT NULL,
      method TEXT NOT NULL DEFAULT 'bank_transfer',
      reference TEXT NOT NULL DEFAULT '',
      paid_at TEXT NOT NULL,
      recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payments_account_idx ON payments(account_id, paid_at);

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activities_customer_idx ON activities(customer_id, created_at);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      due_date TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tasks_account_idx ON tasks(account_id, done);
  `)
}
