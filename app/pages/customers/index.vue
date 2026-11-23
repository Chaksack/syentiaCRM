<script setup lang="ts">
import type { Customer, CustomerStage } from '#shared/types/domain'
import { formatDate, formatMoney, initials, relativeTime, termsLabel } from '#shared/utils/format'

useHead({ title: 'Customers · Syentia CRM' })

const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const { account, accountId } = useCurrentAccount()
const toast = useToast()

// ── List ──
const search = ref('')
const q = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (q.value = value), 250)
})
const stage = ref<CustomerStage | ''>('')

const { data, refresh } = await useFetch('/api/customers', {
  query: { account: accountId, q, stage },
  default: () => ({
    customers: [] as Customer[],
    counts: {
      all: 0,
      active: 0,
      lead: 0,
      at_risk: 0,
      inactive: 0,
    },
  }),
})

const filters = computed(() => [
  { value: '' as const, label: 'All', count: data.value.counts.all },
  { value: 'active' as const, label: 'Active', count: data.value.counts.active },
  { value: 'lead' as const, label: 'Leads', count: data.value.counts.lead },
  { value: 'at_risk' as const, label: 'At risk', count: data.value.counts.at_risk },
  { value: 'inactive' as const, label: 'Inactive', count: data.value.counts.inactive },
].filter(f => f.value === '' || f.count > 0 || stage.value === f.value))

// ── Selected customer (kept in ?id= so it survives reloads and can be linked to) ──
const selectedId = computed(() => (typeof route.query.id === 'string'
  ? route.query.id
  : data.value.customers[0]?.id ?? ''))
const { data: detail, refresh: refreshDetail } = await useFetch(() => `/api/customers/${selectedId.value}`, {
  immediate: !!selectedId.value,
  watch: [selectedId],
})
const selected = computed(() => (selectedId.value
  ? detail.value?.customer ?? null
  : null))

function select(id: string) {
  router.replace({
    query: { ...route.query, id },
  })
}

// Switching account clears the selection, since customers belong to one account.
watch(accountId, () => router.replace({ query: {} }))

// ── Notes ──
const note = ref('')
const noteType = ref<'note' | 'call'>('note')
const savingNote = ref(false)
async function addNote() {
  if (!selected.value || !note.value.trim())
    return
  savingNote.value = true
  try {
    await $fetch(`/api/customers/${selected.value.id}/notes`, {
      method: 'POST',
      body: { type: noteType.value, body: note.value },
    })
    note.value = ''
    await Promise.all([
      refreshDetail(),
      refresh(),
    ])
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
  finally {
    savingNote.value = false
  }
}

// ── Add / edit ──
const formOpen = ref(route.query.new === '1')
const editing = ref<Customer | null>(null)
function openNew() {
  editing.value = null
  formOpen.value = true
}
function openEdit() {
  editing.value = selected.value
  formOpen.value = true
}
async function onSaved(customer: Customer) {
  await refresh()
  if (editing.value)
    await refreshDetail()
  router.replace({
    query: { id: customer.id },
  })
}

// ── CSV import ──
const importOpen = ref(false)
const importing = ref(false)
const importResult = ref<{ imported: number, errors: { row: number, message: string }[] } | null>(null)
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  importing.value = true
  importResult.value = null
  try {
    importResult.value = await $fetch('/api/imports/customers', {
      method: 'POST',
      body: { accountId: accountId.value, csv: await file.text() },
    })
    await refresh()
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
  finally {
    importing.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <PageMain>
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">
          Customers <span class="text-faint">{{ data.counts.all }}</span>
        </h1>
        <p class="m-0 text-muted">
          Companies and contacts billed from {{ account?.name }}
        </p>
      </div>
      <div v-if="can('customers.write')" class="flex flex-wrap gap-2">
        <button type="button" class="btn" @click="importOpen = true; importResult = null">
          Import CSV
        </button>
        <button type="button" class="btn btn-primary" @click="openNew">
          <AppIcon name="plus" :size="14" :stroke-width="1.8" />Add customer
        </button>
      </div>
    </header>

    <div class="flex flex-wrap items-center gap-2.5">
      <label class="flex min-h-11 flex-[1_1_280px] items-center gap-2 rounded bg-surface px-3.5">
        <AppIcon name="search" class="text-muted" />
        <span class="sr-only">Search customers</span>
        <input v-model="search" type="search" placeholder="Search by name, email or phone" class="flex-1 border-0 bg-transparent text-[14px] text-ink outline-offset-4">
      </label>
      <div role="group" aria-label="Filter by stage" class="flex flex-wrap gap-1.5">
        <button v-for="f in filters" :key="f.value" type="button" class="chip" :aria-pressed="stage === f.value" @click="stage = f.value">
          {{ f.label }} {{ f.count }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-2.5">
      <section aria-label="Customer list" class="min-w-0 flex-[3_1_560px] overflow-x-auto rounded border border-line">
        <table class="w-full min-w-[640px]">
          <thead>
            <tr class="bg-surface text-xs text-muted">
              <th class="px-4 py-2.5">
                Customer
              </th>
              <th class="px-2 py-2.5">
                Stage
              </th>
              <th class="px-2 py-2.5 text-right">
                Outstanding ({{ account?.currency }})
              </th>
              <th class="px-2 py-2.5">
                Owner
              </th>
              <th class="py-2.5 pr-4 pl-2">
                Last activity
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in data.customers" :key="c.id"
              class="cursor-pointer hover:bg-surface"
              :class="c.id === selectedId ? '!bg-surface-2' : ''"
              @click="select(c.id)"
            >
              <td class="border-t border-line px-4 py-3">
                <span class="flex items-center gap-2.5">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded bg-surface-3 text-xs">{{ initials(c.name) }}</span>
                  <span class="flex flex-col">
                    <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-left text-ink" :aria-current="c.id === selectedId" @click.stop="select(c.id)">{{ c.name }}</button>
                    <span class="text-xs text-muted">{{ c.contactName || '—' }}</span>
                  </span>
                </span>
              </td>
              <td class="border-t border-line px-2 py-3">
                <StatusPill :stage="c.stage" />
              </td>
              <td class="tabular border-t border-line px-2 py-3 text-right">
                {{ formatMoney(c.outstanding) }}
              </td>
              <td class="border-t border-line px-2 py-3 text-muted">
                {{ c.ownerName ?? '—' }}
              </td>
              <td class="border-t border-line py-3 pr-4 pl-2 text-muted">
                {{ c.lastActivity ? `${c.lastActivity} · ${relativeTime(c.lastActivityAt)}` : '—' }}
              </td>
            </tr>
            <tr v-if="!data.customers.length">
              <td colspan="5" class="border-t border-line px-4 py-12 text-center text-muted">
                {{ q || stage ? 'No customers match.' : 'No customers yet — add your first one.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <aside v-if="selected" aria-label="Selected customer" class="flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded bg-surface p-6">
        <div class="flex items-center gap-3">
          <span class="flex size-12 shrink-0 items-center justify-center rounded bg-ink text-paper">{{ initials(selected.name) }}</span>
          <div class="flex flex-col">
            <h2 class="m-0 text-[22px] leading-[1.3] font-normal tracking-[-0.01em]">
              {{ selected.name }}
            </h2>
            <span class="text-[13px] text-muted">Customer since {{ formatDate(selected.createdAt).slice(3) }}{{ selected.industry ? ` · ${selected.industry}` : '' }}</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="flex flex-col gap-1 rounded bg-paper p-3.5">
            <span class="text-xs text-muted">Outstanding</span><span class="tabular text-[18px]">{{ formatMoney(selected.outstanding, account?.currency) }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded bg-paper p-3.5">
            <span class="text-xs text-muted">Lifetime billed</span><span class="tabular text-[18px]">{{ formatMoney(selected.lifetimeBilled, account?.currency) }}</span>
          </div>
        </div>
        <dl class="m-0 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
          <dt class="text-muted">
            Contact
          </dt><dd class="m-0">
            {{ [selected.contactName, selected.contactRole].filter(Boolean).join(', ') || '—' }}
          </dd>
          <dt class="text-muted">
            Email
          </dt><dd class="m-0 break-all">
            <a v-if="selected.email" :href="`mailto:${selected.email}`">{{ selected.email }}</a><template v-else>
              —
            </template>
          </dd>
          <dt class="text-muted">
            Phone
          </dt><dd class="m-0">
            {{ selected.phone || '—' }}
          </dd>
          <dt class="text-muted">
            Billing
          </dt><dd class="m-0">
            {{ selected.paymentTermsDays === null ? 'Account default terms' : termsLabel(selected.paymentTermsDays) }} · {{ account?.currency }}
          </dd>
          <dt class="text-muted">
            Owner
          </dt><dd class="m-0">
            {{ selected.ownerName ?? '—' }}
          </dd>
          <template v-if="selected.tags.length">
            <dt class="text-muted">
              Tags
            </dt>
            <dd class="m-0 flex flex-wrap gap-1.5">
              <span v-for="t in selected.tags" :key="t" class="rounded-full border border-border px-2 py-px text-xs">{{ t }}</span>
            </dd>
          </template>
        </dl>

        <div class="flex flex-col gap-2.5">
          <h3 class="m-0 text-[14px] font-medium">
            Timeline
          </h3>
          <div class="flex max-h-72 flex-col gap-2.5 overflow-y-auto text-[13px]">
            <div v-for="a in selected.activities" :key="a.id" class="flex justify-between gap-3 border-b border-line pb-2.5">
              <span>{{ a.body }}<span v-if="a.userName" class="text-muted"> · {{ a.userName }}</span></span>
              <span class="shrink-0 text-muted">{{ relativeTime(a.createdAt) === 'today' ? 'Today' : formatDate(a.createdAt, 'day') }}</span>
            </div>
            <p v-if="!selected.activities.length" class="m-0 text-muted">
              No activity yet.
            </p>
          </div>
        </div>

        <form v-if="can('customers.write')" class="flex flex-col gap-2" @submit.prevent="addNote">
          <label class="field">
            <span>Add a note</span>
            <textarea v-model="note" class="input" rows="3" placeholder="Write a note for the team…" />
          </label>
          <div class="flex items-center justify-between gap-2">
            <div role="group" aria-label="Note type" class="flex gap-1.5">
              <button type="button" class="chip !min-h-8" :aria-pressed="noteType === 'note'" @click="noteType = 'note'">
                Note
              </button>
              <button type="button" class="chip !min-h-8" :aria-pressed="noteType === 'call'" @click="noteType = 'call'">
                Call
              </button>
            </div>
            <button type="submit" class="btn btn-sm" :disabled="!note.trim() || savingNote">
              Save note
            </button>
          </div>
        </form>

        <div class="flex flex-wrap gap-2">
          <NuxtLink v-if="can('invoices.write')" :to="`/invoices/new?customer=${selected.id}&account=${selected.accountId}`" class="btn btn-primary">
            New invoice
          </NuxtLink>
          <NuxtLink :to="`/invoices?customer=${selected.id}&period=all`" class="btn btn-ghost">
            Invoices
          </NuxtLink>
          <button v-if="can('customers.write')" type="button" class="btn btn-ghost" @click="openEdit">
            Edit details
          </button>
        </div>
      </aside>
    </div>

    <CustomerFormDialog v-model:open="formOpen" :account-id="accountId" :customer="editing" @saved="onSaved" />

    <AppDialog v-model:open="importOpen" title="Import customers" :description="`Adds customers to ${account?.name} from a CSV file.`">
      <div class="flex flex-col gap-4 text-[13px]">
        <p class="m-0 text-ink-2">
          The first row must be a header. Recognised columns: <code>name</code> (required), <code>contact</code>, <code>role</code>,
          <code>email</code>, <code>phone</code>, <code>address</code>, <code>industry</code>, <code>stage</code>
          (active, lead, at risk, inactive) and <code>tags</code> (separated by semicolons).
        </p>
        <label class="btn self-start" :class="{ 'opacity-50': importing }">
          {{ importing ? 'Importing…' : 'Choose CSV file' }}
          <input type="file" accept=".csv,text/csv" class="sr-only" :disabled="importing" @change="importFile">
        </label>
        <div v-if="importResult" class="flex flex-col gap-2 rounded bg-surface p-3">
          <p class="m-0">
            Imported {{ importResult.imported }} customer{{ importResult.imported === 1 ? '' : 's' }}.
          </p>
          <ul v-if="importResult.errors.length" class="m-0 flex flex-col gap-1 pl-4 text-danger">
            <li v-for="e in importResult.errors.slice(0, 10)" :key="e.row">
              Row {{ e.row }}: {{ e.message }}
            </li>
            <li v-if="importResult.errors.length > 10">
              …and {{ importResult.errors.length - 10 }} more
            </li>
          </ul>
        </div>
      </div>
    </AppDialog>
  </PageMain>
</template>
