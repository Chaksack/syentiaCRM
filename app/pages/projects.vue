<script setup lang="ts">
import type { Project, ProjectStatus } from '#shared/types/domain'
import { CYCLE_LABEL, daysFromToday, formatDate, formatMoney, formatTotals, yearlyEquivalent } from '#shared/utils/format'

useHead({ title: 'Projects · Syentia CRM' })

const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const { account, accountId } = useCurrentAccount()
const toast = useToast()

const { data, refresh } = await useFetch('/api/projects', {
  query: { account: accountId },
  default: () => ({ projects: [] as Project[] }),
})
const projects = computed(() => data.value.projects)

// ── Filters ──
const search = ref('')
const status = ref<ProjectStatus | ''>('')
const countBy = (s: ProjectStatus) => projects.value.filter(p => p.status === s).length
const filters = computed(() => [
  { value: '' as const, label: 'All', count: projects.value.length },
  {
    value: 'active' as const,
    label: 'Active',
    count: countBy('active'),
  },
  {
    value: 'planning' as const,
    label: 'Planning',
    count: countBy('planning'),
  },
  {
    value: 'on_hold' as const,
    label: 'On hold',
    count: countBy('on_hold'),
  },
  {
    value: 'completed' as const,
    label: 'Completed',
    count: countBy('completed'),
  },
].filter(f => f.value === '' || f.count > 0 || status.value === f.value))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return projects.value.filter(p =>
    (!status.value || p.status === status.value)
    && (!q || [p.name, p.customerName, p.description].some(v => v.toLowerCase().includes(q))),
  )
})

// ── Totals: recurring costs on projects that are still running ──
const running = computed(() => projects.value.filter(p => p.status !== 'completed'))
function totalsBy(fn: (p: Project) => number) {
  const totals: Record<string, number> = {}
  for (const p of running.value) totals[p.currency] = (totals[p.currency] ?? 0) + fn(p)
  return formatTotals(totals)
}
const monthlyTotal = computed(() => totalsBy(p => p.monthlyCost))
const yearlyTotal = computed(() => totalsBy(p => p.costs.reduce((s, c) => s + yearlyEquivalent(c.amount, c.frequency), 0)))
const nextDue = computed(() => running.value
  .flatMap(p => p.costs.filter(c => c.nextDueDate).map(c => ({ project: p, cost: c })))
  .sort((a, b) => a.cost.nextDueDate!.localeCompare(b.cost.nextDueDate!))[0] ?? null)

// ── Selection ──
const selectedId = computed(() => typeof route.query.id === 'string'
  ? route.query.id
  : '')
const selected = computed(() => projects.value.find(p => p.id === selectedId.value) ?? filtered.value[0] ?? null)
const selectedYearly = computed(() => selected.value?.costs.reduce((s, c) => s + yearlyEquivalent(c.amount, c.frequency), 0) ?? 0)
function select(id: string) {
  router.replace({
    query: { ...route.query, id },
  })
}
watch(accountId, () => router.replace({ query: {} }))

// ── Add / edit / delete ──
const formOpen = ref(route.query.new === '1')
const editing = ref<Project | null>(null)
const presetCustomer = computed(() => typeof route.query.customer === 'string'
  ? route.query.customer
  : null)
function openNew() {
  editing.value = null
  formOpen.value = true
}
function openEdit() {
  editing.value = selected.value
  formOpen.value = true
}
async function onSaved(project: Project) {
  await refresh()
  router.replace({
    query: { id: project.id },
  })
}

const busy = ref(false)
const confirmDelete = ref(false)
async function remove() {
  if (!selected.value)
    return
  busy.value = true
  try {
    await $fetch(`/api/projects/${selected.value.id}`, { method: 'DELETE' })
    confirmDelete.value = false
    toast.success('Project deleted')
    await router.replace({ query: {} })
    await refresh()
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <PageMain>
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">
          Projects <span class="text-faint">{{ projects.length }}</span>
        </h1>
        <p class="m-0 text-muted">
          Customer projects at {{ account?.name }} and what they cost each month and year.
        </p>
      </div>
      <button v-if="can('customers.write')" type="button" class="btn btn-primary" @click="openNew">
        <AppIcon name="plus" :size="14" :stroke-width="1.8" />New project
      </button>
    </header>

    <section aria-label="Totals" class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Running projects</span>
        <span class="tabular text-[22px] tracking-[-0.02em]">{{ running.length }}</span>
        <span class="text-xs text-muted">{{ countBy('completed') }} completed</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Recurring per month</span>
        <span class="tabular text-[18px] leading-[1.6] tracking-[-0.01em]">{{ monthlyTotal }}</span>
        <span class="text-xs text-muted">Quarterly and yearly costs spread monthly</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Recurring per year</span>
        <span class="tabular text-[18px] leading-[1.6] tracking-[-0.01em]">{{ yearlyTotal }}</span>
        <span class="text-xs text-muted">Excludes completed projects</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Next cost due</span>
        <template v-if="nextDue">
          <span class="tabular text-[18px] leading-[1.6] tracking-[-0.01em]">{{ formatDate(nextDue.cost.nextDueDate) }}</span>
          <span class="truncate text-xs text-muted">{{ nextDue.cost.label }} · {{ nextDue.project.customerName }}</span>
        </template>
        <template v-else>
          <span class="text-[18px] leading-[1.6]">—</span>
          <span class="text-xs text-muted">No due dates set</span>
        </template>
      </div>
    </section>

    <div class="flex flex-wrap items-center gap-2.5">
      <label class="flex min-h-11 flex-[1_1_280px] items-center gap-2 rounded bg-surface px-3.5">
        <AppIcon name="search" class="text-muted" />
        <span class="sr-only">Search projects</span>
        <input v-model="search" type="search" placeholder="Search by project, customer or details" class="flex-1 border-0 bg-transparent text-[14px] text-ink outline-offset-4">
      </label>
      <div role="group" aria-label="Filter by status" class="flex flex-wrap gap-1.5">
        <button v-for="f in filters" :key="f.value" type="button" class="chip" :aria-pressed="status === f.value" @click="status = f.value">
          {{ f.label }} {{ f.count }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-2.5">
      <section aria-label="Project list" class="min-w-0 flex-[3_1_560px] overflow-x-auto rounded border border-line">
        <table class="w-full min-w-[640px]">
          <thead>
            <tr class="bg-surface text-xs text-muted">
              <th class="px-4 py-2.5">
                Project
              </th>
              <th class="px-2 py-2.5">
                Status
              </th>
              <th class="px-2 py-2.5 text-right">
                Per month
              </th>
              <th class="px-2 py-2.5">
                Next due
              </th>
              <th class="py-2.5 pr-4 pl-2">
                Owner
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in filtered" :key="p.id"
              class="cursor-pointer hover:bg-surface"
              :class="p.id === selected?.id ? '!bg-surface-2' : ''"
              @click="select(p.id)"
            >
              <td class="border-t border-line px-4 py-3">
                <span class="flex flex-col">
                  <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-left text-ink" :aria-current="p.id === selected?.id" @click.stop="select(p.id)">{{ p.name }}</button>
                  <span class="text-xs text-muted">{{ p.customerName }}</span>
                </span>
              </td>
              <td class="border-t border-line px-2 py-3">
                <StatusPill :project="p.status" />
              </td>
              <td class="tabular border-t border-line px-2 py-3 text-right whitespace-nowrap">
                {{ p.monthlyCost ? formatMoney(p.monthlyCost, p.currency) : '—' }}
              </td>
              <td class="border-t border-line px-2 py-3 text-muted">
                {{ formatDate(p.nextDueDate) }}
              </td>
              <td class="border-t border-line py-3 pr-4 pl-2 text-muted">
                {{ p.ownerName ?? '—' }}
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="5" class="border-t border-line px-4 py-12 text-center text-muted">
                {{ projects.length ? 'No projects match.' : 'No projects yet — create one for a customer.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <aside v-if="selected" aria-label="Selected project" class="flex min-w-0 flex-[1_1_340px] flex-col gap-5 rounded bg-surface p-6">
        <div class="flex items-start gap-3">
          <span class="flex size-12 shrink-0 items-center justify-center rounded bg-ink text-paper"><AppIcon name="projects" :size="22" /></span>
          <div class="flex min-w-0 flex-col gap-1">
            <h2 class="m-0 text-[22px] leading-[1.3] font-normal tracking-[-0.01em] break-words">
              {{ selected.name }}
            </h2>
            <span class="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <StatusPill :project="selected.status" />
              <NuxtLink :to="`/customers?id=${selected.customerId}`">{{ selected.customerName }}</NuxtLink>
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="flex flex-col gap-1 rounded bg-paper p-3.5">
            <span class="text-xs text-muted">Per month</span><span class="tabular text-[18px]">{{ formatMoney(selected.monthlyCost, selected.currency) }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded bg-paper p-3.5">
            <span class="text-xs text-muted">Per year</span><span class="tabular text-[18px]">{{ formatMoney(selectedYearly, selected.currency) }}</span>
          </div>
        </div>

        <dl class="m-0 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
          <dt class="text-muted">
            Dates
          </dt><dd class="m-0">
            {{ selected.startDate || selected.endDate ? `${formatDate(selected.startDate)} → ${selected.endDate ? formatDate(selected.endDate) : 'ongoing'}` : '—' }}
          </dd>
          <dt class="text-muted">
            Owner
          </dt><dd class="m-0">
            {{ selected.ownerName ?? '—' }}
          </dd>
        </dl>

        <div v-if="selected.description" class="flex flex-col gap-1.5">
          <h3 class="m-0 text-[14px] font-medium">
            Details
          </h3>
          <p class="m-0 text-[13px] whitespace-pre-line text-ink-2">
            {{ selected.description }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-[14px] font-medium">
            Recurring costs
          </h3>
          <table v-if="selected.costs.length" class="w-full text-[13px]">
            <tbody>
              <tr v-for="c in selected.costs" :key="c.id" class="border-b border-line">
                <td class="py-2 pr-2">
                  <span class="flex flex-col">
                    <span>{{ c.label }}</span>
                    <span v-if="c.nextDueDate" class="text-xs text-muted">Next due {{ formatDate(c.nextDueDate) }} · {{ daysFromToday(c.nextDueDate) }}</span>
                  </span>
                </td>
                <td class="tabular py-2 text-right whitespace-nowrap">
                  {{ formatMoney(c.amount, selected.currency) }} <span class="text-xs text-muted">{{ CYCLE_LABEL[c.frequency].per }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="m-0 text-[13px] text-muted">
            No recurring costs recorded.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <NuxtLink v-if="can('invoices.write')" :to="`/invoices/new?customer=${selected.customerId}&account=${selected.accountId}`" class="btn btn-primary">
            New invoice
          </NuxtLink>
          <button v-if="can('customers.write')" type="button" class="btn btn-ghost" @click="openEdit">
            Edit
          </button>
          <button v-if="can('customers.write')" type="button" class="btn btn-ghost btn-danger" @click="confirmDelete = true">
            <AppIcon name="trash" :size="14" />Delete
          </button>
        </div>
      </aside>
    </div>

    <ProjectFormDialog
      v-model:open="formOpen" :account-id="accountId" :currency="account?.currency ?? 'GHS'"
      :project="editing" :customer-id="presetCustomer" @saved="onSaved"
    />

    <AppDialog v-model:open="confirmDelete" title="Delete this project?" :description="`${selected?.name} and its recurring costs will be removed. This can’t be undone.`" :width="440">
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" @click="confirmDelete = false">
          Keep it
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="remove">
          Delete project
        </button>
      </div>
    </AppDialog>
  </PageMain>
</template>
