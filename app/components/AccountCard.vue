<script setup lang="ts">
import type { Account, InvoiceTemplate } from '#shared/types/domain'
import { CURRENCIES, INVOICE_TEMPLATES, PAYMENT_TERMS } from '#shared/types/domain'
import { BRAND_COLORS, formatInvoiceNumber, TEMPLATE_INFO, termsLabel } from '#shared/utils/format'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ saved: [account: Account] }>()
const toast = useToast()

const fields = [
  'name',
  'mark',
  'legalName',
  'taxId',
  'address',
  'email',
  'phone',
  'color',
  'numberPrefix',
  'nextNumber',
  'numberPadding',
  'currency',
  'paymentTermsDays',
  'defaultAdjustments',
  'paymentDetails',
  'invoiceNotes',
  'defaultTemplate',
] as const
type Form = Pick<Account, typeof fields[number]>

// Deep copy so editing the default adjustments never mutates the saved account until Save.
const pick = (a: Account): Form => JSON.parse(JSON.stringify(Object.fromEntries(fields.map(f => [f, a[f]])))) as Form
const form = reactive<Form>(pick(props.account))
watch(() => props.account, a => Object.assign(form, pick(a)))

const dirty = computed(() => fields.some(f => JSON.stringify(form[f]) !== JSON.stringify(props.account[f])))
const swatches = computed(() => [
  ...new Set([props.account.color, ...BRAND_COLORS]),
].slice(0, 5))
const nextPreview = computed(() => formatInvoiceNumber(form.numberPrefix, Number(form.nextNumber) || 1, Number(form.numberPadding) || 4))
const saving = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  saving.value = true
  try {
    const { account } = await $fetch(`/api/accounts/${props.account.id}`, { method: 'PATCH', body: form })
    emit('saved', account!)
    toast.success(`${account!.name} saved`)
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    saving.value = false
  }
}

const uploading = ref<'' | 'main' | 'light'>('')
async function upload(event: Event, variant: 'main' | 'light') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  uploading.value = variant
  const body = new FormData()
  body.append('file', file)
  try {
    const { account } = await $fetch(`/api/accounts/${props.account.id}/logo`, {
      method: 'POST',
      body,
      query: variant === 'light'
        ? { variant }
        : {},
    })
    emit('saved', account!)
    toast.success(variant === 'light'
      ? 'Light logo uploaded'
      : 'Logo uploaded')
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
  finally {
    uploading.value = ''
    input.value = ''
  }
}

async function removeLogo(variant: 'main' | 'light') {
  try {
    const { account } = await $fetch(`/api/accounts/${props.account.id}/logo`, {
      method: 'DELETE',
      query: variant === 'light'
        ? { variant }
        : {},
    })
    emit('saved', account!)
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
}

function thumb(t: InvoiceTemplate) {
  return {
    band: t === 'bold'
      ? form.color
      : 'transparent',
    bandH: t === 'bold'
      ? 22
      : 0,
    total: t === 'minimal'
      ? '#cdcdc9'
      : form.color,
  }
}
</script>

<template>
  <section class="flex flex-col overflow-hidden rounded border border-line">
    <div class="flex flex-wrap items-center justify-between gap-3 bg-surface px-6 py-5">
      <div class="flex items-center gap-3">
        <AccountMark :mark="form.mark || '?'" :color="form.color" :size="40" />
        <div class="flex flex-col">
          <h2 class="m-0 text-[20px] leading-[1.3] font-normal tracking-[-0.01em]">
            {{ form.name || 'Untitled account' }}
          </h2>
          <span class="text-xs text-muted">{{ account.stats.customers }} customers · {{ account.stats.invoices }} invoices</span>
        </div>
      </div>
      <span class="rounded-full px-2.5 py-0.5 text-xs" :class="account.isPrimary ? 'bg-[#cfcebc]' : 'bg-surface-3'">{{ account.isPrimary ? 'Primary' : 'Active' }}</span>
    </div>

    <form class="flex flex-col gap-[22px] p-6" @submit.prevent="save">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex h-20 w-[120px] items-center justify-center rounded border border-dashed border-border bg-white">
          <AccountLogo :account="{ ...account, color: form.color, mark: form.mark, name: form.name }" :size="44" />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="text-[13px]">Invoice logo</span>
          <span class="text-xs text-muted">SVG or PNG, at least 400 px wide. A light version is used on coloured headers.</span>
          <div class="flex flex-wrap gap-1.5">
            <label class="btn btn-sm">
              {{ uploading === 'main' ? 'Uploading…' : account.logoUrl ? 'Replace logo' : 'Upload logo' }}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only" @change="upload($event, 'main')">
            </label>
            <label class="btn btn-sm">
              {{ uploading === 'light' ? 'Uploading…' : account.logoLightUrl ? 'Replace light version' : 'Light version' }}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only" @change="upload($event, 'light')">
            </label>
            <button v-if="account.logoUrl" type="button" class="btn btn-sm btn-ghost" @click="removeLogo('main')">
              Remove
            </button>
          </div>
          <div v-if="account.logoLightUrl" class="flex items-center gap-2 text-xs text-muted">
            <span class="inline-flex h-7 items-center rounded px-2" :style="{ background: form.color }"><img :src="account.logoLightUrl" alt="Light logo" class="h-5"></span>
            Light version set ·
            <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-xs text-accent" @click="removeLogo('light')">
              remove
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[13px] text-muted">Brand colour</span>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="c in swatches" :key="c" type="button" class="size-8 cursor-pointer rounded border-0"
            :style="{ background: c, boxShadow: form.color === c ? '0 0 0 2px #f7f7f4, 0 0 0 3px #26251e' : 'none' }"
            :aria-label="`Use ${c}`" :aria-pressed="form.color === c" @click="form.color = c"
          />
          <label class="relative size-8 cursor-pointer overflow-hidden rounded border border-border" title="Custom colour">
            <span class="sr-only">Custom colour</span>
            <input v-model="form.color" type="color" class="absolute -inset-2 size-12 cursor-pointer border-0 p-0">
          </label>
          <input v-model="form.color" class="input input-sm tabular !w-24" aria-label="Hex colour" maxlength="7">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <label class="field">Account name<input v-model="form.name" class="input" required></label>
        <label class="field">Short mark<input v-model="form.mark" class="input" maxlength="3" required></label>
        <label class="field">Legal name<input v-model="form.legalName" class="input"></label>
        <label class="field">Tax ID (TIN)<input v-model="form.taxId" class="input"></label>
        <label class="field col-span-2">Address<input v-model="form.address" class="input"></label>
        <label class="field">Billing email<input v-model="form.email" class="input"></label>
        <label class="field">Phone<input v-model="form.phone" class="input"></label>
        <label class="field">Number prefix<input v-model="form.numberPrefix" class="input"></label>
        <label class="field">Next number<input v-model.number="form.nextNumber" class="input tabular" type="number" min="1"></label>
        <label class="field">Default currency
          <select v-model="form.currency" class="input">
            <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.code }}</option>
          </select>
        </label>
        <label class="field">Payment terms
          <select v-model.number="form.paymentTermsDays" class="input">
            <option v-for="d in PAYMENT_TERMS" :key="d" :value="d">{{ termsLabel(d) }}</option>
          </select>
        </label>
        <div class="field col-span-2">
          <span>Next invoice</span>
          <span class="tabular flex min-h-11 items-center text-ink">{{ nextPreview }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[13px] text-muted">Discounts, taxes &amp; deductions on new invoices</span>
        <AdjustmentsEditor v-model="form.defaultAdjustments" :currency="form.currency" empty-text="None — new invoices start without taxes or discounts." />
        <span class="text-xs text-muted">Each invoice starts with these and can change them. Ghana rates since 1 January 2026: NHIL 2.5%, GETFund levy 2.5%, VAT 15%, all on the same base.</span>
      </div>

      <label class="field">Payment details shown on invoices
        <textarea v-model="form.paymentDetails" class="input" rows="2" placeholder="Bank · account number&#10;Mobile money number" />
      </label>
      <label class="field">Default notes on new invoices
        <textarea v-model="form.invoiceNotes" class="input" rows="2" />
      </label>

      <div class="flex flex-col gap-2.5">
        <span class="text-[13px] text-muted">Invoice template</span>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="t in INVOICE_TEMPLATES" :key="t" type="button" :aria-pressed="form.defaultTemplate === t"
            class="flex cursor-pointer flex-col gap-2 rounded bg-paper p-2 text-left"
            :class="form.defaultTemplate === t ? 'border-[1.5px] border-ink' : 'border border-rule'"
            @click="form.defaultTemplate = t"
          >
            <span class="box-border flex h-[92px] flex-col gap-1 overflow-hidden rounded-sm bg-white p-2" aria-hidden="true">
              <span class="-mx-2 -mt-2 mb-0.5 block rounded-[1px]" :style="{ height: `${thumb(t).bandH}px`, background: thumb(t).band }" />
              <span class="flex justify-between"><span class="block h-2 w-[18px] rounded-[1px]" :style="{ background: form.color }" /><span class="block h-1.5 w-[26px] bg-border" /></span>
              <span class="mt-1.5 block h-[3px] bg-surface-3" />
              <span class="block h-[3px] w-4/5 bg-surface-3" />
              <span class="block h-[3px] w-3/5 bg-surface-3" />
              <span class="mt-auto block h-1 w-2/5 self-end" :style="{ background: thumb(t).total }" />
            </span>
            <span class="flex justify-between text-[13px]">{{ TEMPLATE_INFO[t].name }}<span class="text-xs text-muted">{{ account.defaultTemplate === t ? 'Default' : TEMPLATE_INFO[t].tag }}</span></span>
          </button>
        </div>
      </div>

      <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
        {{ error }}
      </p>

      <div class="-mx-6 -mb-6 mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">
        <span v-if="dirty" class="mr-auto text-xs text-muted">Unsaved changes</span>
        <button type="button" class="btn btn-sm !min-h-10" :disabled="!dirty" @click="Object.assign(form, pick(account)); error = ''">
          Discard
        </button>
        <button type="submit" class="btn btn-primary btn-sm !min-h-10" :disabled="!dirty || saving">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </form>
  </section>
</template>
