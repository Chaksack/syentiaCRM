<script setup lang="ts">
import type { Account, Currency, Invoice, InvoiceCustomer, InvoiceTemplate, PaymentMethod } from '#shared/types/domain'
import { CURRENCIES, INVOICE_TEMPLATES, PAYMENT_METHODS, PAYMENT_TERMS } from '#shared/types/domain'
import {
  addDays,
  daysBetween,
  formatDate,
  formatMoney,
  invoiceTotals,
  lineAmount,
  parseMoney,
  PAYMENT_METHOD_LABEL,
  TEMPLATE_INFO,
  termsLabel,
  todayIso,
} from '#shared/utils/format'

const route = useRoute()
const { can } = useAuth()
const toast = useToast()

const { data, error, refresh } = await useFetch(() => `/api/invoices/${route.params.id}`)
const { data: accountsData } = await useFetch('/api/accounts', {
  default: () => ({ accounts: [] as Account[] }),
})

const invoice = computed(() => data.value?.invoice ?? null)
const editable = computed(() => invoice.value?.status === 'draft' && can('invoices.write'))
useHead(() => ({
  title: invoice.value
    ? `${invoice.value.number} · syentiaCRM`
    : 'Invoice · syentiaCRM',
}))

// ─── Draft editor state ─────────────────────────────────────────────────────

interface EditableItem { key: number, description: string, quantity: string, rate: string }
let itemKey = 0
function toEditable(inv: Invoice): EditableItem[] {
  return inv.items.map(i => ({
    key: itemKey++,
    description: i.description,
    quantity: String(i.quantity),
    rate: i.rate
      ? formatMoney(i.rate)
      : '',
  }))
}

const draft = reactive({
  accountId: '',
  customerId: null as string | null,
  currency: 'GHS' as Currency,
  issueDate: '' as string,
  dueDate: '' as string,
  template: 'ledger' as InvoiceTemplate,
  notes: '',
  taxRate: '0',
  items: [] as EditableItem[],
})

function loadDraft(inv: Invoice) {
  Object.assign(draft, {
    accountId: inv.accountId,
    customerId: inv.customerId,
    currency: inv.currency,
    issueDate: inv.issueDate ?? '',
    dueDate: inv.dueDate ?? '',
    template: inv.template,
    notes: inv.notes,
    taxRate: String(inv.taxRate),
    items: toEditable(inv),
  })
}
if (invoice.value)
  loadDraft(invoice.value)

const account = computed(() => accountsData.value.accounts.find(a => a.id === draft.accountId) ?? invoice.value?.account ?? null)

const { data: customersData } = await useFetch('/api/customers', {
  query: {
    account: computed(() => draft.accountId),
  },
  immediate: editable.value,
  watch: [
    () => draft.accountId,
  ],
  default: () => ({ customers: [] as { id: string, name: string, contactName: string, address: string, email: string, paymentTermsDays: number | null }[] }),
})
const previewCustomer = computed<InvoiceCustomer | null>(() => {
  if (!editable.value)
    return invoice.value?.customer ?? null
  const c = customersData.value.customers.find(x => x.id === draft.customerId)
  return c
    ? {
        id: c.id,
        name: c.name,
        contactName: c.contactName,
        address: c.address,
        email: c.email,
      }
    : null
})

const items = computed(() => draft.items.map((i) => {
  const quantity = Number.parseFloat(i.quantity) || 0
  const rate = parseMoney(i.rate)
  const safeRate = Number.isNaN(rate)
    ? 0
    : rate
  return {
    description: i.description,
    quantity,
    rate: safeRate,
    amount: lineAmount(quantity, safeRate),
    invalid: Number.isNaN(rate),
  }
}))
const taxRate = computed(() => Math.min(100, Math.max(0, Number.parseFloat(draft.taxRate) || 0)))
const totals = computed(() => invoiceTotals(items.value, taxRate.value))
const termsDays = computed(() => (draft.issueDate && draft.dueDate
  ? daysBetween(draft.issueDate, draft.dueDate)
  : null))

function setTerms(days: string) {
  if (days !== '' && draft.issueDate)
    draft.dueDate = addDays(draft.issueDate, Number(days))
}

function pickAccount(id: string) {
  if (id === draft.accountId)
    return
  const next = accountsData.value.accounts.find(a => a.id === id)
  draft.accountId = id
  draft.customerId = null // customers belong to one account
  if (next) {
    draft.template = next.defaultTemplate
    draft.currency = next.currency
    draft.taxRate = String(next.defaultTaxRate)
    if (draft.issueDate)
      draft.dueDate = addDays(draft.issueDate, next.paymentTermsDays)
  }
}

watch(() => draft.customerId, (id, previous) => {
  if (!id || id === previous || previous === undefined)
    return
  const c = customersData.value.customers.find(x => x.id === id)
  if (c?.paymentTermsDays != null && draft.issueDate)
    draft.dueDate = addDays(draft.issueDate, c.paymentTermsDays)
})

function addLine() {
  draft.items.push({
    key: itemKey++,
    description: '',
    quantity: '1',
    rate: '',
  })
}
function removeLine(key: number) {
  draft.items = draft.items.filter(i => i.key !== key)
}

// ─── Autosave ───────────────────────────────────────────────────────────────

const saveState = ref<'saved' | 'pending' | 'saving' | 'error'>('saved')
let saveTimer: ReturnType<typeof setTimeout> | undefined
let loading = false

function payload() {
  return {
    accountId: draft.accountId,
    customerId: draft.customerId,
    currency: draft.currency,
    issueDate: draft.issueDate || null,
    dueDate: draft.dueDate || null,
    template: draft.template,
    notes: draft.notes,
    taxRate: taxRate.value,
    items: items.value.map(({ description, quantity, rate }) => ({ description, quantity, rate })),
  }
}

/** Flushes pending edits; false if the save failed. */
async function save(): Promise<boolean> {
  clearTimeout(saveTimer)
  if (!editable.value || saveState.value === 'saved')
    return true
  saveState.value = 'saving'
  try {
    const res = await $fetch(`/api/invoices/${route.params.id}`, {
      method: 'PATCH',
      body: payload(),
    })
    // Keep what the user is typing; take only server-owned fields (number, account, totals).
    if (data.value && res.invoice) {
      data.value = {
        invoice: { ...res.invoice },
      }
    }
    saveState.value = saveTimer ? 'pending' : 'saved'
    return true
  }
  catch (e) {
    saveState.value = 'error'
    toast.error(errorMessage(e))
    return false
  }
}

watch(draft, () => {
  if (loading || !editable.value)
    return
  saveState.value = 'pending'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    save()
  }, 700)
}, { deep: true })

onBeforeRouteLeave(async () => {
  if (saveState.value === 'pending')
    await save()
})

const saveLabel = computed(() => ({
  saved: 'Draft · autosaved',
  pending: 'Draft · unsaved changes',
  saving: 'Draft · saving…',
  error: 'Draft · couldn’t save',
})[saveState.value])

// ─── Actions ────────────────────────────────────────────────────────────────

const sending = ref(false)
async function send() {
  saveState.value = 'pending'
  if (!(await save()))
    return
  sending.value = true
  try {
    await $fetch(`/api/invoices/${route.params.id}/send`, { method: 'POST' })
    await refresh()
    toast.success(`Invoice ${invoice.value?.number} sent`)
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
  finally {
    sending.value = false
  }
}

const confirmDelete = ref(false)
async function deleteDraft() {
  clearTimeout(saveTimer)
  try {
    await $fetch(`/api/invoices/${route.params.id}`, { method: 'DELETE' })
    saveState.value = 'saved'
    toast.success('Draft deleted')
    await navigateTo('/invoices')
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
}

async function openPdf() {
  if (saveState.value === 'pending')
    await save()
  window.open(`/invoices/${route.params.id}/print?print=1`, '_blank')
}

// ─── Payments (sent invoices) ───────────────────────────────────────────────

const balance = computed(() => (invoice.value
  ? invoice.value.total - invoice.value.amountPaid
  : 0))
const paymentOpen = ref(false)
const payment = reactive({
  amount: '',
  method: 'bank_transfer' as PaymentMethod,
  reference: '',
  paidAt: todayIso(),
})
const paymentError = ref('')
function openPayment() {
  Object.assign(payment, {
    amount: formatMoney(balance.value),
    method: 'bank_transfer',
    reference: '',
    paidAt: todayIso(),
  })
  paymentError.value = ''
  paymentOpen.value = true
}
async function recordPayment() {
  paymentError.value = ''
  const amount = parseMoney(payment.amount)
  if (Number.isNaN(amount) || amount <= 0) {
    paymentError.value = 'Enter the amount received.'
    return
  }
  try {
    await $fetch(`/api/invoices/${route.params.id}/payments`, {
      method: 'POST',
      body: { ...payment, amount },
    })
    paymentOpen.value = false
    await refresh()
    toast.success(invoice.value?.status === 'paid'
      ? 'Paid in full'
      : 'Payment recorded')
  }
  catch (e) {
    paymentError.value = errorMessage(e)
  }
}

// Reload the editor when navigating between invoices, or when a send flips it to read-only.
watch(() => invoice.value?.id, () => {
  if (!invoice.value)
    return
  loading = true
  loadDraft(invoice.value)
  nextTick(() => (loading = false))
})
</script>

<template>
  <PageMain v-if="error">
    <p class="m-0 rounded bg-danger-bg px-4 py-3 text-danger">
      {{ errorMessage(error) }} <NuxtLink to="/invoices">
        Back to invoices
      </NuxtLink>
    </p>
  </PageMain>

  <div v-else-if="invoice && account" class="flex min-h-screen flex-col">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-[clamp(20px,3vw,40px)] py-3.5">
      <div class="flex flex-wrap items-center gap-3.5">
        <NuxtLink to="/invoices" aria-label="Back to invoices" class="inline-flex size-11 items-center justify-center rounded text-ink hover:bg-surface-2 hover:text-ink">
          <AppIcon name="back" :size="18" />
        </NuxtLink>
        <div class="flex flex-col">
          <h1 class="m-0 flex items-center gap-2 text-[20px] font-normal tracking-[-0.01em]">
            {{ editable ? 'New invoice' : 'Invoice' }} <span class="tabular text-faint">{{ invoice.number }}</span>
            <StatusPill v-if="!editable" :status="invoice.status" />
          </h1>
          <span class="text-xs" :class="saveState === 'error' ? 'text-danger' : 'text-muted'" aria-live="polite">
            {{ editable ? saveLabel : invoice.sentAt ? `Sent ${formatDate(invoice.sentAt)}` : 'Draft' }}
          </span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="editable" type="button" class="btn btn-ghost btn-danger" @click="confirmDelete = true">
          <AppIcon name="trash" :size="14" /> Delete
        </button>
        <button type="button" class="btn" @click="openPdf">
          Download PDF
        </button>
        <button v-if="editable && can('invoices.send')" type="button" class="btn btn-primary" :disabled="sending" @click="send">
          {{ sending ? 'Sending…' : 'Send invoice' }}
        </button>
        <button v-if="!editable && can('invoices.send') && balance > 0 && invoice.status !== 'draft'" type="button" class="btn btn-primary" @click="openPayment">
          Record payment
        </button>
      </div>
    </header>

    <div class="flex flex-1 flex-wrap">
      <!-- ── Left column: editor or summary ── -->
      <section
        :aria-label="editable ? 'Invoice details' : 'Invoice summary'"
        class="box-border flex min-w-0 flex-[1_1_460px] flex-col gap-7 border-r border-line px-[clamp(20px,3vw,40px)] pt-8 pb-12"
      >
        <template v-if="editable">
          <p v-if="!can('invoices.send')" class="m-0 rounded bg-surface px-3.5 py-2.5 text-[13px] text-ink-2">
            Your role can draft invoices; a manager or finance colleague sends them.
          </p>

          <fieldset class="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend class="mb-2.5 p-0 text-[13px] text-muted">
              Issue from account
            </legend>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
              <button
                v-for="a in accountsData.accounts" :key="a.id" type="button" :aria-pressed="a.id === draft.accountId"
                class="flex min-h-16 cursor-pointer items-center gap-3 rounded px-3.5 py-3 text-left"
                :class="a.id === draft.accountId ? 'border-[1.5px] border-ink bg-surface-2' : 'border border-border bg-paper hover:bg-surface'"
                @click="pickAccount(a.id)"
              >
                <AccountMark :mark="a.mark" :color="a.color" :size="36" />
                <span class="flex min-w-0 flex-col">
                  <span class="font-medium">{{ a.name }}</span>
                  <span class="truncate text-xs text-muted">Prefix {{ a.numberPrefix }} · {{ TEMPLATE_INFO[a.defaultTemplate].name }}</span>
                </span>
              </button>
            </div>
            <p class="m-0 text-xs text-muted">
              Logo, colours, numbering, bank details and default template come from the account.
              <NuxtLink v-if="can('admin')" to="/accounts">
                Edit branding →
              </NuxtLink>
            </p>
          </fieldset>

          <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
            <label class="field">Customer
              <select v-model="draft.customerId" class="input">
                <option :value="null" disabled>Choose a customer…</option>
                <option v-for="c in customersData.customers" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <span v-if="!customersData.customers.length" class="text-xs">
                No customers in {{ account.name }} yet. <NuxtLink v-if="can('customers.write')" to="/customers?new=1">Add one →</NuxtLink>
              </span>
            </label>
            <label class="field">Currency
              <select v-model="draft.currency" class="input">
                <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.code }} — {{ c.name }}</option>
              </select>
            </label>
            <label class="field">Issue date
              <input v-model="draft.issueDate" type="date" class="input">
            </label>
            <div class="field">
              <label for="due-date">Due date</label>
              <div class="flex gap-1.5">
                <input id="due-date" v-model="draft.dueDate" type="date" class="input min-w-0 flex-1" :min="draft.issueDate || undefined">
                <select class="input !w-auto" aria-label="Payment terms" :value="PAYMENT_TERMS.includes(termsDays as never) ? String(termsDays) : ''" @change="setTerms(($event.target as HTMLSelectElement).value)">
                  <option value="" disabled>
                    {{ termsDays === null ? 'Terms' : `${termsDays} days` }}
                  </option>
                  <option v-for="d in PAYMENT_TERMS" :key="d" :value="String(d)">
                    {{ termsLabel(d) }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2.5">
            <h2 class="m-0 text-[13px] font-normal text-muted">
              Line items
            </h2>
            <div class="overflow-x-auto rounded border border-line">
              <table class="w-full min-w-[520px]">
                <thead>
                  <tr class="bg-surface text-xs text-muted">
                    <th class="px-3 py-2">
                      Description
                    </th>
                    <th class="w-20 px-2 py-2 text-right">
                      Qty
                    </th>
                    <th class="w-32 px-2 py-2 text-right">
                      Rate
                    </th>
                    <th class="w-28 px-2 py-2 text-right">
                      Amount
                    </th>
                    <th class="w-10">
                      <span class="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, i) in draft.items" :key="item.key">
                    <td class="border-t border-line px-2 py-1.5">
                      <input v-model="item.description" class="input input-sm !border-transparent !bg-transparent hover:!border-border focus:!border-border" :aria-label="`Line ${i + 1} description`" placeholder="Describe the work">
                    </td>
                    <td class="border-t border-line px-1 py-1.5">
                      <input v-model="item.quantity" inputmode="decimal" class="input input-sm tabular text-right" :aria-label="`Line ${i + 1} quantity`">
                    </td>
                    <td class="border-t border-line px-1 py-1.5">
                      <input
                        v-model="item.rate" inputmode="decimal" placeholder="0.00"
                        class="input input-sm tabular text-right" :class="items[i]?.invalid ? '!border-danger' : ''"
                        :aria-label="`Line ${i + 1} rate`" :aria-invalid="items[i]?.invalid"
                      >
                    </td>
                    <td class="tabular border-t border-line px-2 py-1.5 text-right">
                      {{ formatMoney(items[i]?.amount ?? 0) }}
                    </td>
                    <td class="border-t border-line pr-1.5">
                      <button type="button" class="flex size-8 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-muted hover:bg-surface-2 hover:text-ink" :aria-label="`Remove line ${i + 1}`" @click="removeLine(item.key)">
                        <AppIcon name="close" :size="14" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <button type="button" class="min-h-10 cursor-pointer rounded border border-dashed border-border bg-transparent px-3.5 text-ink hover:bg-surface" @click="addLine">
                + Add line
              </button>
              <div class="tabular flex items-center gap-4 text-[13px]">
                <label class="flex items-center gap-2 text-muted">Tax %
                  <input v-model="draft.taxRate" inputmode="decimal" class="input input-sm tabular !w-20 text-right">
                </label>
                <span>Total <strong class="font-medium">{{ draft.currency }} {{ formatMoney(totals.total) }}</strong></span>
              </div>
            </div>
          </div>

          <fieldset class="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend class="mb-2.5 p-0 text-[13px] text-muted">
              Template <span class="text-faint">· default for {{ account.name }}: {{ TEMPLATE_INFO[account.defaultTemplate].name }}</span>
            </legend>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="t in INVOICE_TEMPLATES" :key="t" type="button" class="chip !min-h-10 !px-4" :aria-pressed="draft.template === t" @click="draft.template = t">
                {{ TEMPLATE_INFO[t].name }}
              </button>
            </div>
          </fieldset>

          <label class="field">Notes to customer
            <textarea v-model="draft.notes" class="input" rows="3" />
          </label>
        </template>

        <template v-else>
          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div class="flex flex-col gap-1 rounded bg-surface p-4">
              <span class="text-xs text-muted">Total</span><span class="tabular text-[20px]">{{ formatMoney(invoice.total) }}</span>
            </div>
            <div class="flex flex-col gap-1 rounded bg-surface p-4">
              <span class="text-xs text-muted">Paid</span><span class="tabular text-[20px]">{{ formatMoney(invoice.amountPaid) }}</span>
            </div>
            <div class="flex flex-col gap-1 rounded bg-surface p-4">
              <span class="text-xs text-muted">Balance</span>
              <span class="tabular text-[20px]" :class="invoice.status === 'overdue' ? 'text-danger' : ''">{{ formatMoney(balance) }}</span>
            </div>
          </div>

          <dl class="m-0 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
            <dt class="text-muted">
              Issued from
            </dt>
            <dd class="m-0 flex items-center gap-2">
              <AccountMark :mark="account.mark" :color="account.color" :size="20" />{{ account.name }}
            </dd>
            <dt class="text-muted">
              Customer
            </dt>
            <dd class="m-0">
              <NuxtLink v-if="invoice.customer" :to="`/customers?id=${invoice.customer.id}`">
                {{ invoice.customer.name }}
              </NuxtLink><template v-else>
                —
              </template>
            </dd>
            <dt class="text-muted">
              Issued
            </dt><dd class="m-0">
              {{ formatDate(invoice.issueDate) }}
            </dd>
            <dt class="text-muted">
              Due
            </dt><dd class="m-0">
              {{ formatDate(invoice.dueDate) }}
            </dd>
            <dt class="text-muted">
              Template
            </dt><dd class="m-0">
              {{ TEMPLATE_INFO[invoice.template].name }}
            </dd>
          </dl>

          <div class="flex flex-col gap-2.5">
            <h2 class="section-title !text-[16px]">
              Payments
            </h2>
            <div v-for="p in invoice.payments" :key="p.id" class="flex justify-between gap-3 border-b border-line pb-2.5 text-[13px]">
              <span>
                {{ formatDate(p.paidAt) }} · {{ PAYMENT_METHOD_LABEL[p.method] }}<span v-if="p.reference" class="text-muted"> · {{ p.reference }}</span>
                <span v-if="p.recordedBy" class="text-muted"> · by {{ p.recordedBy }}</span>
              </span>
              <span class="tabular">{{ formatMoney(p.amount, invoice.currency) }}</span>
            </div>
            <p v-if="!invoice.payments.length" class="m-0 text-[13px] text-muted">
              No payments recorded yet.
            </p>
          </div>
        </template>
      </section>

      <!-- ── Right column: live preview ── -->
      <section aria-label="Preview" class="box-border flex min-w-0 flex-[1_1_520px] flex-col items-center gap-3.5 bg-desk px-[clamp(16px,3vw,48px)] pt-8 pb-12">
        <div class="flex self-stretch justify-between text-xs text-ink-2">
          <span>{{ editable ? 'Live preview' : 'Preview' }} · {{ TEMPLATE_INFO[editable ? draft.template : invoice.template].name }} template</span><span>A4</span>
        </div>
        <div class="w-full max-w-[560px] overflow-hidden rounded bg-white shadow-[0_12px_40px_rgb(38_37_30/0.18)]">
          <InvoiceDocument
            v-if="editable"
            :number="invoice.number" :template="draft.template" :currency="draft.currency"
            :issue-date="draft.issueDate || null" :due-date="draft.dueDate || null" :notes="draft.notes" :tax-rate="taxRate"
            :items="items" :subtotal="totals.subtotal" :tax="totals.tax" :total="totals.total"
            :account="account" :customer="previewCustomer" size="preview"
          />
          <InvoiceDocument
            v-else
            :number="invoice.number" :template="invoice.template" :currency="invoice.currency"
            :issue-date="invoice.issueDate" :due-date="invoice.dueDate" :notes="invoice.notes" :tax-rate="invoice.taxRate"
            :items="invoice.items" :subtotal="invoice.subtotal" :tax="invoice.tax" :total="invoice.total" :amount-paid="invoice.amountPaid"
            :account="invoice.account" :customer="invoice.customer" size="preview"
          />
        </div>
      </section>
    </div>

    <AppDialog v-model:open="confirmDelete" title="Delete this draft?" :description="`${invoice.number} will be removed. This can’t be undone.`" :width="440">
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" @click="confirmDelete = false">
          Keep draft
        </button>
        <button type="button" class="btn btn-primary" @click="deleteDraft">
          Delete draft
        </button>
      </div>
    </AppDialog>

    <AppDialog v-model:open="paymentOpen" title="Record payment" :description="`${invoice.number} · ${formatMoney(balance, invoice.currency)} outstanding`" :width="480">
      <form class="flex flex-col gap-3.5" @submit.prevent="recordPayment">
        <div class="grid grid-cols-2 gap-3">
          <label class="field">Amount ({{ invoice.currency }})
            <input v-model="payment.amount" class="input tabular" inputmode="decimal" required>
          </label>
          <label class="field">Date received
            <input v-model="payment.paidAt" class="input" type="date" required>
          </label>
          <label class="field">Method
            <select v-model="payment.method" class="input">
              <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ PAYMENT_METHOD_LABEL[m] }}</option>
            </select>
          </label>
          <label class="field">Reference
            <input v-model="payment.reference" class="input" placeholder="Optional">
          </label>
        </div>
        <p v-if="paymentError" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {{ paymentError }}
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" @click="paymentOpen = false">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            Record payment
          </button>
        </div>
      </form>
    </AppDialog>
  </div>
</template>
