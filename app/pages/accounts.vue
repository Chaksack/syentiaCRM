<script setup lang="ts">
import type { Account } from '#shared/types/domain'
import { BRAND_COLORS } from '#shared/utils/format'

definePageMeta({ permission: 'admin' })
useHead({ title: 'Accounts & branding · syentiaCRM' })

const { refresh: refreshSession } = useAuth()
const toast = useToast()
const { data, refresh } = await useFetch('/api/accounts', {
  default: () => ({ accounts: [] as Account[] }),
})

async function onSaved() {
  // The sidebar switcher shows names and colours too.
  await Promise.all([
    refresh(),
    refreshSession(),
  ])
}

const addOpen = ref(false)
const form = reactive({
  name: '',
  mark: '',
  numberPrefix: '',
  color: BRAND_COLORS[2]!,
})
const error = ref('')
async function addAccount() {
  error.value = ''
  try {
    await $fetch('/api/accounts', {
      method: 'POST',
      body: {
        ...form,
        legalName: '',
        taxId: '',
        address: '',
        email: '',
        phone: '',
        nextNumber: 1,
        numberPadding: 4,
        currency: 'GHS',
        paymentTermsDays: 30,
        defaultTaxRate: 0,
        paymentDetails: '',
        invoiceNotes: 'Thank you for your business.',
        defaultTemplate: 'ledger',
      },
    })
    addOpen.value = false
    toast.success(`${form.name} created`)
    Object.assign(form, { name: '', mark: '', numberPrefix: '' })
    await onSaved()
  }
  catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageMain :gap="28">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex max-w-[640px] flex-col gap-1">
        <h1 class="page-title">
          Accounts &amp; branding
        </h1>
        <p class="m-0 text-muted">
          Each account is a separate billing identity, with its own logo, colours, legal details, numbering and invoice template.
          Customers and invoices belong to one account.
        </p>
      </div>
      <button type="button" class="btn btn-primary" @click="addOpen = true">
        <AppIcon name="plus" :size="14" :stroke-width="1.8" />Add account
      </button>
    </header>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-2.5">
      <AccountCard v-for="a in data.accounts" :key="a.id" :account="a" @saved="onSaved" />
    </div>

    <section class="flex flex-wrap items-center justify-between gap-4 rounded bg-surface-2 px-6 py-5">
      <div class="flex flex-col gap-0.5">
        <h2 class="m-0 text-[16px] font-medium">
          Team access
        </h2>
        <span class="text-[13px] text-ink-2">Choose who can see and invoice from each account. Admins see all accounts.</span>
      </div>
      <NuxtLink to="/team" class="btn btn-sm !min-h-10">
        Manage members
      </NuxtLink>
    </section>

    <AppDialog v-model:open="addOpen" title="Add account" description="A new billing identity. You can fill in branding and legal details after." :width="480">
      <form class="flex flex-col gap-3.5" @submit.prevent="addAccount">
        <div class="grid grid-cols-2 gap-3">
          <label class="field col-span-2">Account name<input v-model="form.name" class="input" required></label>
          <label class="field">Short mark<input v-model="form.mark" class="input" maxlength="3" placeholder="e.g. A3" required></label>
          <label class="field">Number prefix<input v-model="form.numberPrefix" class="input" placeholder="e.g. A3-2026-"></label>
          <label class="field col-span-2">Brand colour
            <span class="flex items-center gap-2">
              <button
                v-for="c in BRAND_COLORS" :key="c" type="button" class="size-8 cursor-pointer rounded border-0"
                :style="{ background: c, boxShadow: form.color === c ? '0 0 0 2px #f7f7f4, 0 0 0 3px #26251e' : 'none' }"
                :aria-label="`Use ${c}`" :aria-pressed="form.color === c" @click="form.color = c"
              />
            </span>
          </label>
        </div>
        <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {{ error }}
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" @click="addOpen = false">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            Create account
          </button>
        </div>
      </form>
    </AppDialog>
  </PageMain>
</template>
