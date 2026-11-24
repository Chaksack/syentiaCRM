<script setup lang="ts">
import type { BillingCycle, Currency, Customer, Project, ProjectStatus } from '#shared/types/domain'
import { BILLING_CYCLES, CURRENCIES, PROJECT_STATUSES } from '#shared/types/domain'
import { CYCLE_LABEL, formatMoney, monthlyEquivalent, parseMoney, PROJECT_STATUS_STYLE, yearlyEquivalent } from '#shared/utils/format'

const props = defineProps<{
  accountId: string
  currency: Currency
  project?: Project | null
  /** Pre-selects the customer on a new project. */
  customerId?: string | null
}>()
const emit = defineEmits<{ saved: [project: Project] }>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const accountQuery = {
  account: computed(() => props.accountId),
}
const [{ data: customerList }, { data: directory }] = await Promise.all([
  useFetch('/api/customers', {
    query: accountQuery,
    default: () => ({ customers: [] as Customer[] }),
    transform: d => ({
      customers: [...d.customers].sort((a, b) => a.name.localeCompare(b.name)),
    }),
  }),
  useFetch('/api/team/directory', {
    query: accountQuery,
    default: () => ({ people: [] }),
  }),
])

// Amounts are kept as typed text so "1,2" isn't reformatted under the cursor.
interface CostRow { key: number, label: string, amount: string, frequency: BillingCycle, nextDueDate: string }
let nextKey = 0

function blank() {
  return {
    customerId: '',
    name: '',
    description: '',
    status: 'active' as ProjectStatus,
    startDate: '',
    endDate: '',
    ownerId: null as string | null,
    currency: props.currency,
    costs: [] as CostRow[],
  }
}
const form = reactive(blank())
const error = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  error.value = ''
  const p = props.project
  Object.assign(form, blank(), p
    ? {
        ...p,
        startDate: p.startDate ?? '',
        endDate: p.endDate ?? '',
        costs: p.costs.map(c => ({
          key: nextKey++,
          label: c.label,
          amount: c.amount
            ? formatMoney(c.amount)
            : '',
          frequency: c.frequency,
          nextDueDate: c.nextDueDate ?? '',
        })),
      }
    : { customerId: props.customerId ?? '' })
}, { immediate: true })

function addCost() {
  form.costs.push({
    key: nextKey++,
    label: '',
    amount: '',
    frequency: 'monthly',
    nextDueDate: '',
  })
}
function removeCost(key: number) {
  form.costs = form.costs.filter(c => c.key !== key)
}

const parsedCosts = computed(() => form.costs.map((c) => {
  const amount = parseMoney(c.amount)
  return {
    ...c,
    value: Number.isNaN(amount)
      ? 0
      : amount,
    invalid: Number.isNaN(amount) || amount < 0,
  }
}))
const monthly = computed(() => parsedCosts.value.reduce((s, c) => s + monthlyEquivalent(c.value, c.frequency), 0))
const yearly = computed(() => parsedCosts.value.reduce((s, c) => s + yearlyEquivalent(c.value, c.frequency), 0))

async function save() {
  if (parsedCosts.value.some(c => c.invalid)) {
    error.value = 'Enter each recurring cost as a number, e.g. 1,200.00'
    return
  }
  error.value = ''
  saving.value = true
  const body = {
    customerId: form.customerId,
    name: form.name,
    description: form.description,
    status: form.status,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    ownerId: form.ownerId,
    currency: form.currency,
    costs: parsedCosts.value
      .filter(c => c.label.trim() || c.value) // drop untouched blank rows
      .map(c => ({
        label: c.label,
        amount: c.value,
        frequency: c.frequency,
        nextDueDate: c.nextDueDate || null,
      })),
  }
  try {
    const res = props.project
      ? await $fetch(`/api/projects/${props.project.id}`, { method: 'PATCH', body })
      : await $fetch('/api/projects', {
          method: 'POST',
          body: { ...body, accountId: props.accountId },
        })
    toast.success(props.project
      ? 'Project updated'
      : `${res.project!.name} added`)
    emit('saved', res.project!)
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="project ? 'Edit project' : 'New project'" :width="760">
    <form class="flex flex-col gap-5" @submit.prevent="save">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="field">Project name
          <input v-model="form.name" class="input" required placeholder="e.g. ERP rollout, Website retainer">
        </label>
        <label class="field">Customer
          <select v-model="form.customerId" class="input" required>
            <option value="" disabled>Choose a customer</option>
            <option v-for="c in customerList.customers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="field">Status
          <select v-model="form.status" class="input">
            <option v-for="s in PROJECT_STATUSES" :key="s" :value="s">{{ PROJECT_STATUS_STYLE[s].label }}</option>
          </select>
        </label>
        <label class="field">Owner
          <select v-model="form.ownerId" class="input">
            <option :value="null">{{ project ? 'Unassigned' : 'Me' }}</option>
            <option v-for="p in directory.people" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="field">Start date
          <input v-model="form.startDate" class="input" type="date">
        </label>
        <label class="field">End date
          <input v-model="form.endDate" class="input" type="date">
        </label>
        <label class="field sm:col-span-2">Project details
          <textarea v-model="form.description" class="input" rows="3" placeholder="Scope, deliverables, environments, key contacts…" />
        </label>
      </div>

      <section class="flex flex-col gap-3" aria-labelledby="project-costs-heading">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <h3 id="project-costs-heading" class="m-0 text-[14px] font-medium">
            Recurring costs
          </h3>
          <label class="field !flex-row items-center">Currency
            <select v-model="form.currency" class="input input-sm !w-24">
              <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.code }}</option>
            </select>
          </label>
        </div>
        <div v-if="form.costs.length" class="flex flex-col gap-2">
          <div class="hidden grid-cols-[1fr_130px_120px_150px_36px] gap-2 text-xs text-muted sm:grid">
            <span>Description</span><span class="text-right">Amount</span><span>Every</span><span>Next due</span><span />
          </div>
          <div v-for="(c, i) in parsedCosts" :key="c.key" class="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_130px_120px_150px_36px]">
            <input v-model="form.costs[i]!.label" class="input input-sm col-span-2 sm:col-span-1" placeholder="e.g. Hosting, Support retainer" aria-label="Description">
            <input v-model="form.costs[i]!.amount" class="input input-sm tabular text-right" inputmode="decimal" placeholder="0.00" aria-label="Amount" :aria-invalid="c.invalid">
            <select v-model="form.costs[i]!.frequency" class="input input-sm" aria-label="Frequency">
              <option v-for="f in BILLING_CYCLES" :key="f" :value="f">
                {{ CYCLE_LABEL[f].name }}
              </option>
            </select>
            <input v-model="form.costs[i]!.nextDueDate" class="input input-sm" type="date" aria-label="Next due">
            <button type="button" class="btn btn-ghost btn-sm !min-h-9 !w-9 !p-0" :aria-label="`Remove ${c.label || 'cost'}`" @click="removeCost(c.key)">
              <AppIcon name="trash" :size="14" />
            </button>
          </div>
        </div>
        <p v-else class="m-0 text-[13px] text-muted">
          No recurring costs yet — add hosting, licences, support or retainer fees.
        </p>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="btn btn-sm" @click="addCost">
            <AppIcon name="plus" :size="14" />Add cost
          </button>
          <span v-if="form.costs.length" class="tabular text-[13px] text-ink-2">
            {{ formatMoney(monthly, form.currency) }} / month · {{ formatMoney(yearly, form.currency) }} / year
          </span>
        </div>
      </section>

      <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
        {{ error }}
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" @click="open = false">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Saving…' : project ? 'Save changes' : 'Create project' }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>
