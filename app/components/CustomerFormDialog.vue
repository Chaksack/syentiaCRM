<script setup lang="ts">
import type { Customer, CustomerStage } from '#shared/types/domain'
import { CUSTOMER_STAGES, PAYMENT_TERMS } from '#shared/types/domain'
import { STAGE_STYLE, termsLabel } from '#shared/utils/format'

const props = defineProps<{ accountId: string, customer?: Customer | null }>()
const emit = defineEmits<{ saved: [customer: Customer] }>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const { data: directory } = await useFetch('/api/team/directory', {
  query: {
    account: computed(() => props.accountId),
  },
  default: () => ({ people: [] }),
})

function blank() {
  return {
    name: '',
    industry: '',
    contactName: '',
    contactRole: '',
    email: '',
    phone: '',
    address: '',
    stage: 'lead' as CustomerStage,
    ownerId: null as string | null,
    paymentTermsDays: null as number | null,
    tags: '',
  }
}
const form = reactive(blank())
const error = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  error.value = ''
  const c = props.customer
  Object.assign(form, blank(), c
    ? {
        ...c,
        tags: c.tags.join(', '),
      }
    : {})
}, { immediate: true })

async function save() {
  error.value = ''
  saving.value = true
  const body = {
    ...form,
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
  }
  try {
    const res = props.customer
      ? await $fetch(`/api/customers/${props.customer.id}`, { method: 'PATCH', body })
      : await $fetch('/api/customers', {
          method: 'POST',
          body: { ...body, accountId: props.accountId },
        })
    toast.success(props.customer
      ? 'Customer updated'
      : `${res.customer!.name} added`)
    emit('saved', res.customer!)
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
  <AppDialog v-model:open="open" :title="customer ? 'Edit customer' : 'Add customer'" :width="640">
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="field sm:col-span-2">Company or customer name
          <input v-model="form.name" class="input" required>
        </label>
        <label class="field">Contact name
          <input v-model="form.contactName" class="input">
        </label>
        <label class="field">Contact role
          <input v-model="form.contactRole" class="input" placeholder="e.g. Finance lead">
        </label>
        <label class="field">Email
          <input v-model="form.email" class="input" type="email">
        </label>
        <label class="field">Phone
          <input v-model="form.phone" class="input" type="tel">
        </label>
        <label class="field sm:col-span-2">Billing address
          <textarea v-model="form.address" class="input" rows="2" />
        </label>
        <label class="field">Industry
          <input v-model="form.industry" class="input">
        </label>
        <label class="field">Stage
          <select v-model="form.stage" class="input">
            <option v-for="s in CUSTOMER_STAGES" :key="s" :value="s">{{ STAGE_STYLE[s].label }}</option>
          </select>
        </label>
        <label class="field">Owner
          <select v-model="form.ownerId" class="input">
            <option :value="null">{{ customer ? 'Unassigned' : 'Me' }}</option>
            <option v-for="p in directory.people" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="field">Payment terms
          <select v-model="form.paymentTermsDays" class="input">
            <option :value="null">Account default</option>
            <option v-for="d in PAYMENT_TERMS" :key="d" :value="d">{{ termsLabel(d) }}</option>
          </select>
        </label>
        <label class="field sm:col-span-2">Tags
          <input v-model="form.tags" class="input" placeholder="Comma-separated, e.g. Retainer, Priority">
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
          {{ saving ? 'Saving…' : customer ? 'Save changes' : 'Add customer' }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>
