<script setup lang="ts">
import type { InvoiceStatus } from '#shared/types/domain'
import { formatDate, formatMoney, TEMPLATE_INFO } from '#shared/utils/format'

useHead({ title: 'Invoices · syentiaCRM' })

const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const { accounts } = useCurrentAccount()

// Filters live in the URL so views can be shared and survive reloads.
function str(v: unknown, fallback: string) {
  return typeof v === 'string' && v
    ? v
    : fallback
}
const status = computed(() => str(route.query.status, '') as InvoiceStatus | '')
const account = computed(() => str(route.query.account, 'all'))
const period = computed(() => str(route.query.period, '90d'))
const customer = computed(() => str(route.query.customer, ''))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

function setFilter(patch: Record<string, string | number | undefined>) {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries({
    ...route.query,
    page: undefined,
    ...patch,
  })) {
    if (v !== undefined && v !== '' && v !== null)
      query[k] = String(v)
  }
  router.replace({ query })
}

const query = computed(() => ({
  status: status.value,
  account: account.value,
  period: period.value,
  customer: customer.value,
  page: page.value,
  pageSize: 10,
}))
const { data } = await useFetch('/api/invoices', { query })

const accountById = computed(() => Object.fromEntries(accounts.value.map(a => [a.id, a])))

const tabs = computed(() => [
  { value: '' as const, label: 'All' },
  { value: 'draft' as const, label: 'Draft' },
  { value: 'sent' as const, label: 'Sent' },
  { value: 'overdue' as const, label: 'Overdue' },
  { value: 'paid' as const, label: 'Paid' },
].map(t => ({ ...t, count: data.value?.counts[t.value || 'all'] ?? 0 })))

function plural(n: number) {
  return `${n} invoice${n === 1
    ? ''
    : 's'}`
}
const firstRow = computed(() => (data.value && data.value.total
  ? (data.value.page - 1) * data.value.pageSize + 1
  : 0))
const lastRow = computed(() => (data.value
  ? Math.min(data.value.total, data.value.page * data.value.pageSize)
  : 0))
const exportHref = computed(() => {
  const params = new URLSearchParams({
    status: status.value,
    account: account.value,
    period: period.value,
    customer: customer.value,
  })
  return `/api/exports/invoices?${params}`
})
</script>

<template>
  <PageMain>
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">
          Invoices
        </h1>
        <p class="m-0 text-muted">
          Every invoice is issued from one account, with that account’s logo, numbering and template.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a :href="exportHref" class="btn" download>Export</a>
        <NuxtLink v-if="can('invoices.write')" to="/invoices/new" class="btn btn-primary">
          <AppIcon name="plus" :size="14" :stroke-width="1.8" />New invoice
        </NuxtLink>
      </div>
    </header>

    <section v-if="data" aria-label="Totals" class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Draft</span>
        <span class="tabular text-[22px] tracking-[-0.02em]">GHS {{ formatMoney(data.totals.draft.amount) }}</span>
        <span class="text-xs text-muted">{{ plural(data.totals.draft.count) }}</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Awaiting payment</span>
        <span class="tabular text-[22px] tracking-[-0.02em]">GHS {{ formatMoney(data.totals.awaiting.amount) }}</span>
        <span class="text-xs text-muted">{{ plural(data.totals.awaiting.count) }}</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Overdue</span>
        <span class="tabular text-[22px] tracking-[-0.02em] text-danger">GHS {{ formatMoney(data.totals.overdue.amount) }}</span>
        <span class="text-xs text-muted">{{ plural(data.totals.overdue.count) }}</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Paid · last 30 days</span>
        <span class="tabular text-[22px] tracking-[-0.02em]">GHS {{ formatMoney(data.totals.paid30.amount) }}</span>
        <span class="text-xs text-muted">{{ plural(data.totals.paid30.count) }}</span>
      </div>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-2.5 border-b border-line">
      <div role="tablist" aria-label="Invoice status" class="flex flex-wrap gap-1">
        <button
          v-for="t in tabs" :key="t.value" role="tab" type="button" :aria-selected="status === t.value"
          class="min-h-11 cursor-pointer border-0 border-b-2 bg-transparent px-3"
          :class="status === t.value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'"
          @click="setFilter({ status: t.value })"
        >
          {{ t.label }} <span class="text-muted">{{ t.count }}</span>
        </button>
      </div>
      <div class="flex flex-wrap gap-2 pb-2">
        <label v-if="accounts.length > 1" class="flex items-center gap-2 text-[13px] text-muted">Account
          <select class="input input-sm !w-auto" :value="account" @change="setFilter({ account: ($event.target as HTMLSelectElement).value })">
            <option value="all">All accounts</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-[13px] text-muted">Period
          <select class="input input-sm !w-auto" :value="period" @change="setFilter({ period: ($event.target as HTMLSelectElement).value })">
            <option value="90d">Last 90 days</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="customer" class="-mt-2 m-0 flex items-center gap-2 text-[13px] text-muted">
      Showing one customer’s invoices.
      <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-accent" @click="setFilter({ customer: undefined })">
        Show all
      </button>
    </p>

    <div class="overflow-x-auto">
      <table class="data-table w-full min-w-[820px]">
        <thead>
          <tr>
            <th>Number</th>
            <th>Issued from</th>
            <th>Customer</th>
            <th>Template</th>
            <th>Issued</th>
            <th>Due</th>
            <th class="text-right">
              Amount (GHS)
            </th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data?.items" :key="r.id" class="hover:bg-surface">
            <td class="tabular">
              <NuxtLink :to="`/invoices/${r.id}`" class="text-ink underline decoration-border underline-offset-4 hover:text-ink">
                {{ r.number }}
              </NuxtLink>
            </td>
            <td>
              <span v-if="accountById[r.accountId]" class="inline-flex items-center gap-2">
                <AccountMark :mark="accountById[r.accountId]!.mark" :color="accountById[r.accountId]!.color" :size="20" />
                {{ accountById[r.accountId]!.name }}
              </span>
            </td>
            <td>{{ r.customerName ?? '—' }}</td>
            <td class="text-muted">
              {{ TEMPLATE_INFO[r.template].name }}
            </td>
            <td class="text-muted">
              {{ r.issueDate ? formatDate(r.issueDate, 'day') : '—' }}
            </td>
            <td class="text-muted">
              {{ r.status === 'draft' ? '—' : formatDate(r.dueDate) }}
            </td>
            <td class="tabular text-right">
              {{ formatMoney(r.total) }}
            </td>
            <td><StatusPill :status="r.status" /></td>
          </tr>
          <tr v-if="data && !data.items.length">
            <td colspan="8" class="!py-12 text-center text-muted">
              No invoices match these filters.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="data" class="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
      <span>Showing {{ firstRow }}–{{ lastRow }} of {{ data.total }}</span>
      <div class="flex gap-1.5">
        <button type="button" class="btn btn-sm !min-w-11 !rounded" aria-label="Previous page" :disabled="page <= 1" @click="setFilter({ page: page - 1 })">
          <AppIcon name="back" :size="14" />
        </button>
        <button type="button" class="btn btn-sm !min-w-11 !rounded" aria-label="Next page" :disabled="lastRow >= data.total" @click="setFilter({ page: page + 1 })">
          <AppIcon name="next" :size="14" />
        </button>
      </div>
    </div>
  </PageMain>
</template>
