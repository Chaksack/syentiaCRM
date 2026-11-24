<script setup lang="ts">
import type { BillingCycle, Currency, Customer, License } from '#shared/types/domain'
import { BILLING_CYCLES, CURRENCIES } from '#shared/types/domain'
import { CYCLE_LABEL, formatMoney, parseMoney } from '#shared/utils/format'

const props = defineProps<{
  accountId: string
  currency: Currency
  license?: License | null
  /** Pre-selects the customer on a new licence (e.g. when added from a customer's panel). */
  customerId?: string | null
}>()
const emit = defineEmits<{ saved: [license: License] }>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const { data: customerList } = await useFetch('/api/customers', {
  query: {
    account: computed(() => props.accountId),
  },
  default: () => ({ customers: [] as Customer[] }),
  transform: d => ({
    customers: [...d.customers].sort((a, b) => a.name.localeCompare(b.name)),
  }),
})

function blank() {
  return {
    name: '',
    issuer: '',
    reference: '',
    customerId: null as string | null,
    startDate: '',
    renewalDate: '',
    cycle: 'yearly' as BillingCycle,
    cost: '',
    currency: props.currency,
    autoRenew: false,
    cancelled: false,
    notes: '',
  }
}
const form = reactive(blank())
const error = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  error.value = ''
  const l = props.license
  Object.assign(form, blank(), l
    ? {
        ...l,
        startDate: l.startDate ?? '',
        renewalDate: l.renewalDate ?? '',
        cost: l.cost
          ? formatMoney(l.cost)
          : '',
        cancelled: l.status === 'cancelled',
      }
    : { customerId: props.customerId ?? null })
}, { immediate: true })

const costInvalid = computed(() => Number.isNaN(parseMoney(form.cost)) || parseMoney(form.cost) < 0)

async function save() {
  if (costInvalid.value) {
    error.value = 'Enter the cost as a number, e.g. 1,200.00'
    return
  }
  error.value = ''
  saving.value = true
  const body = {
    customerId: form.customerId,
    name: form.name,
    issuer: form.issuer,
    reference: form.reference,
    startDate: form.startDate || null,
    renewalDate: form.renewalDate || null,
    cycle: form.cycle,
    cost: parseMoney(form.cost),
    currency: form.currency,
    autoRenew: form.autoRenew,
    cancelled: form.cancelled,
    notes: form.notes,
  }
  try {
    const res = props.license
      ? await $fetch(`/api/licenses/${props.license.id}`, { method: 'PATCH', body })
      : await $fetch('/api/licenses', {
          method: 'POST',
          body: { ...body, accountId: props.accountId },
        })
    toast.success(props.license
      ? 'Licence updated'
      : `${res.license!.name} added`)
    emit('saved', res.license!)
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
  <AppDialog v-model:open="open" :title="license ? 'Edit licence' : 'Add licence'" :width="640">
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="field sm:col-span-2">Licence, permit or subscription
          <input v-model="form.name" class="input" required placeholder="e.g. Business operating permit, Microsoft 365 E3">
        </label>
        <label class="field">Issuer or vendor
          <input v-model="form.issuer" class="input" placeholder="e.g. Registrar-General, Microsoft">
        </label>
        <label class="field">Licence number or key
          <input v-model="form.reference" class="input">
        </label>
        <label class="field sm:col-span-2">Held by
          <select v-model="form.customerId" class="input">
            <option :value="null">Our company</option>
            <option v-for="c in customerList.customers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="field">Start date
          <input v-model="form.startDate" class="input" type="date">
        </label>
        <label class="field">Renewal date
          <input v-model="form.renewalDate" class="input" type="date">
          <span class="text-xs">Leave empty if it doesn’t expire.</span>
        </label>
        <label class="field">Cost per cycle
          <span class="flex gap-2">
            <select v-model="form.currency" class="input !w-24 shrink-0" aria-label="Currency">
              <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.code }}</option>
            </select>
            <input v-model="form.cost" class="input tabular text-right" inputmode="decimal" placeholder="0.00" :aria-invalid="costInvalid">
          </span>
        </label>
        <label class="field">Renews
          <select v-model="form.cycle" class="input">
            <option v-for="c in BILLING_CYCLES" :key="c" :value="c">{{ CYCLE_LABEL[c].name }}</option>
          </select>
        </label>
        <label class="field sm:col-span-2">Notes
          <textarea v-model="form.notes" class="input" rows="2" placeholder="Seats, renewal contact, where the certificate is kept…" />
        </label>
        <label class="flex items-center gap-2 text-[13px]">
          <input v-model="form.autoRenew" type="checkbox" class="size-4">
          Renews automatically
        </label>
        <label v-if="license" class="flex items-center gap-2 text-[13px]">
          <input v-model="form.cancelled" type="checkbox" class="size-4">
          Cancelled — no longer renewing
        </label>
      </div>
      <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
        {{ error }}
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" @click="open = false">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Saving…' : license ? 'Save changes' : 'Add licence' }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>
