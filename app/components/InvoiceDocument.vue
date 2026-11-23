<script setup lang="ts">
import type { Account, InvoiceBreakdown, InvoiceCustomer, InvoiceItem, InvoiceTemplate } from '#shared/types/domain'
import { adjustmentLabel, daysBetween, formatDate, formatMoney, termsLabel } from '#shared/utils/format'

/**
 * One invoice in one of the three templates. Sized in `em` so the same markup renders as the
 * editor's live preview (`size="preview"`, 12px base) and as the printable A4 page (16px base).
 */
const props = withDefaults(defineProps<{
  number: string
  template: InvoiceTemplate
  currency: string
  issueDate: string | null
  dueDate: string | null
  notes: string
  items: InvoiceItem[]
  breakdown: InvoiceBreakdown
  amountPaid?: number
  account: Account
  customer: InvoiceCustomer | null
  size?: 'preview' | 'page'
}>(), { amountPaid: 0, size: 'page' })

const brand = computed(() => props.account.color)
const isBold = computed(() => props.template === 'bold')
const isMinimal = computed(() => props.template === 'minimal')
const rule = computed(() => (isMinimal.value ? '#f2f2ef' : '#e2e2df'))
const balance = computed(() => props.breakdown.payable - props.amountPaid)
const discounts = computed(() => props.breakdown.lines.filter(l => l.kind === 'discount'))
const taxes = computed(() => props.breakdown.lines.filter(l => l.kind === 'tax'))
const deductions = computed(() => props.breakdown.lines.filter(l => l.kind === 'deduction'))
const lines = computed(() => props.items.filter(i => i.description.trim() || i.amount))
const paymentLines = computed(() => props.account.paymentDetails.split('\n').map(l => l.trim()).filter(Boolean))
const terms = computed(() => (props.issueDate && props.dueDate
  ? termsLabel(Math.max(0, daysBetween(props.issueDate, props.dueDate)))
  : ''))
const contactLine = computed(() => [props.account.taxId && `TIN ${props.account.taxId}`, props.account.email, props.account.phone].filter(Boolean).join(' · '))
/** Sender block lines, skipping whatever the account hasn't filled in yet. */
const fromLines = computed(() => [props.account.legalName, props.account.address, contactLine.value].filter(Boolean))
const boldFromLines = computed(() => [props.account.legalName, props.account.taxId && `TIN ${props.account.taxId}`].filter(Boolean))
const money = (minor: number) => formatMoney(minor)
function qty(q: number) {
  return Number.isInteger(q)
    ? String(q)
    : q.toFixed(2).replace(/0$/, '')
}
const labelColour = computed(() => (isBold.value ? brand.value : '#6b6a65'))
</script>

<template>
  <article
    class="invoice-doc flex flex-col bg-white text-ink"
    :class="size === 'page' ? 'min-h-[1123px] w-[794px]' : 'w-full'"
    :style="{ fontSize: size === 'page' ? '16px' : '12px', lineHeight: 1.5 }"
  >
    <!-- Bold: brand-coloured header band -->
    <header v-if="isBold" class="flex flex-col gap-[2.5em] px-[4em] pt-[3.5em] pb-[3em] text-paper" :style="{ background: brand }">
      <div class="flex items-center justify-between gap-[1em]">
        <div class="flex items-center gap-[0.75em]">
          <AccountLogo :account="account" on-colour :size="size === 'page' ? 44 : 34" />
          <span class="text-[1.375em] tracking-[-0.02em]">{{ account.name }}</span>
        </div>
        <span class="flex flex-col text-right text-[0.875em] leading-[1.6] opacity-85"><span v-for="line in boldFromLines" :key="line">{{ line }}</span></span>
      </div>
      <div class="flex items-end justify-between gap-[1.5em]">
        <div class="flex flex-col gap-[0.375em]">
          <h1 class="m-0 text-[4em] leading-[0.95] font-normal tracking-[-0.04em]">
            Invoice
          </h1>
          <span class="tabular opacity-85">{{ number }}</span>
        </div>
        <div class="flex flex-col items-end gap-[0.125em]">
          <span class="text-[0.8125em] tracking-[0.08em] uppercase opacity-85">Amount due</span>
          <span class="tabular text-[2em] tracking-[-0.02em]">{{ currency }} {{ money(balance) }}</span>
        </div>
      </div>
    </header>

    <div class="flex flex-1 flex-col" :class="isBold ? 'gap-[2.5em] px-[4em] pt-[2.75em] pb-[3.5em]' : 'gap-[2.5em] px-[4em] pt-[4em] pb-[3.5em]'">
      <!-- Ledger / Minimal: white header -->
      <header v-if="!isBold" class="flex items-start justify-between gap-[1em]" :style="isMinimal ? {} : { paddingBottom: '1.75em', borderBottom: `1px solid ${rule}` }">
        <div class="flex flex-col gap-[0.875em]">
          <div class="flex items-center gap-[0.75em]">
            <AccountLogo :account="account" :size="isMinimal ? (size === 'page' ? 32 : 26) : (size === 'page' ? 44 : 34)" />
            <span class="text-[1.375em] tracking-[-0.02em]">{{ account.name }}</span>
          </div>
          <div class="text-[0.875em] leading-[1.6] text-muted">
            <span v-for="line in fromLines" :key="line" class="block">{{ line }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-[0.375em] text-right">
          <h1 class="m-0 leading-none font-normal tracking-[-0.03em]" :class="isMinimal ? 'text-[1.75em]' : 'text-[2.5em]'">
            Invoice
          </h1>
          <span class="tabular text-[0.9375em] text-muted">{{ number }}</span>
        </div>
      </header>

      <section class="grid grid-cols-3 gap-[1.5em]">
        <div class="flex flex-col gap-[0.25em]">
          <span class="text-[0.75em] tracking-[0.08em] uppercase" :style="{ color: labelColour }">Bill to</span>
          <span v-if="customer">{{ customer.name }}</span>
          <span v-else class="text-faint">No customer selected</span>
          <span v-if="customer" class="text-[0.875em] whitespace-pre-line text-muted"><template v-if="customer.contactName">Attn: {{ customer.contactName }}<br></template>{{ customer.address }}</span>
        </div>
        <div class="flex flex-col gap-[0.25em]">
          <span class="text-[0.75em] tracking-[0.08em] uppercase" :style="{ color: labelColour }">Issued</span>
          <span>{{ formatDate(issueDate, 'long') }}</span>
        </div>
        <div class="flex flex-col gap-[0.25em]">
          <span class="text-[0.75em] tracking-[0.08em] uppercase" :style="{ color: labelColour }">Due</span>
          <span>{{ formatDate(dueDate, 'long') }}</span>
          <span v-if="terms" class="text-[0.875em] text-muted">{{ terms }}</span>
        </div>
      </section>

      <table class="w-full">
        <thead>
          <tr
            class="text-[0.75em] tracking-[0.08em] uppercase"
            :style="isBold ? { background: '#f2f1ed', color: brand } : { color: '#6b6a65' }"
          >
            <th
              v-for="(h, i) in ['Description', 'Qty', 'Rate', 'Amount']" :key="h"
              :class="[i ? 'text-right' : '', isBold ? 'px-[1.17em] py-[1em] font-medium' : 'px-0 pt-0 pb-[0.83em] font-normal']"
              :style="[
                isBold ? {} : { borderBottom: `1px solid ${isMinimal ? '#e2e2df' : '#26251e'}` },
                i === 1 ? { width: '5em' } : i === 2 ? { width: '10em' } : i === 3 ? { width: '10.8em' } : {},
              ]"
            >
              {{ h }}
            </th>
          </tr>
        </thead>
        <tbody class="tabular">
          <tr v-for="(item, i) in lines" :key="item.id ?? i">
            <td :class="isBold ? 'px-[0.875em]' : ''" class="py-[1em]" :style="{ borderBottom: `1px solid ${rule}` }">
              {{ item.description || '—' }}
            </td>
            <td :class="isBold ? 'px-[0.5em]' : ''" class="py-[1em] text-right" :style="{ borderBottom: `1px solid ${rule}` }">
              {{ qty(item.quantity) }}
            </td>
            <td :class="isBold ? 'px-[0.5em]' : ''" class="py-[1em] text-right" :style="{ borderBottom: `1px solid ${rule}` }">
              {{ money(item.rate) }}
            </td>
            <td :class="isBold ? 'px-[0.875em]' : ''" class="py-[1em] text-right" :style="{ borderBottom: `1px solid ${rule}` }">
              {{ money(item.amount) }}
            </td>
          </tr>
          <tr v-if="!lines.length">
            <td colspan="4" class="py-[1em] text-muted" :style="{ borderBottom: `1px solid ${rule}` }">
              No line items yet
            </td>
          </tr>
        </tbody>
      </table>

      <section class="flex justify-end">
        <div class="tabular flex w-[18.75em] flex-col gap-[0.625em]">
          <div class="flex justify-between">
            <span class="text-muted">Subtotal</span><span>{{ money(breakdown.subtotal) }}</span>
          </div>
          <div v-for="(l, i) in discounts" :key="`d${i}`" class="flex justify-between gap-[1em]">
            <span class="text-muted">{{ adjustmentLabel(l) }}</span><span>−{{ money(l.amount) }}</span>
          </div>
          <div v-if="discounts.length && taxes.length" class="flex justify-between">
            <span class="text-muted">Amount before tax</span><span>{{ money(breakdown.net) }}</span>
          </div>
          <div v-for="(l, i) in taxes" :key="`t${i}`" class="flex justify-between gap-[1em]">
            <span class="text-muted">{{ adjustmentLabel(l) }}</span><span>{{ money(l.amount) }}</span>
          </div>
          <div v-if="taxes.length > 1" class="flex justify-between">
            <span class="text-muted">Total taxes &amp; levies</span><span>{{ money(breakdown.tax) }}</span>
          </div>
          <div
            v-if="isBold"
            class="flex items-center justify-between rounded px-[1em] py-[0.875em] text-paper"
            :style="{ background: brand }"
          >
            <span>{{ deductions.length ? 'Total' : 'Total due' }}</span><span class="text-[1.375em] tracking-[-0.02em]">{{ currency }} {{ money(breakdown.total) }}</span>
          </div>
          <div
            v-else class="flex items-baseline justify-between pt-[0.875em]"
            :style="{ borderTop: isMinimal ? '1px solid #cdcdc9' : `2px solid ${brand}` }"
          >
            <span>{{ deductions.length ? 'Total' : 'Total due' }}</span><span class="text-[1.625em] tracking-[-0.02em]">{{ currency }} {{ money(breakdown.total) }}</span>
          </div>
          <template v-if="deductions.length">
            <div v-for="(l, i) in deductions" :key="`w${i}`" class="flex justify-between gap-[1em]">
              <span class="text-muted">Less {{ adjustmentLabel(l) }}</span><span>−{{ money(l.amount) }}</span>
            </div>
            <div class="flex justify-between font-medium">
              <span>Amount payable</span><span>{{ currency }} {{ money(breakdown.payable) }}</span>
            </div>
          </template>
          <template v-if="amountPaid > 0">
            <div class="flex justify-between">
              <span class="text-muted">Paid</span><span>−{{ money(amountPaid) }}</span>
            </div>
            <div class="flex justify-between font-medium">
              <span>Balance due</span><span>{{ currency }} {{ money(balance) }}</span>
            </div>
          </template>
        </div>
      </section>

      <footer
        class="mt-auto grid grid-cols-2 gap-[2em] text-[0.875em]"
        :class="isBold ? 'rounded bg-surface p-[1.7em]' : 'pt-[1.7em]'"
        :style="isBold ? {} : { borderTop: `1px solid ${rule}` }"
      >
        <div class="flex flex-col gap-[0.25em]">
          <span class="text-[0.857em] tracking-[0.08em] uppercase" :style="{ color: labelColour }">{{ isBold ? 'Pay by bank transfer' : 'Payment' }}</span>
          <span v-for="(line, i) in paymentLines" :key="i">{{ line }}</span>
          <span class="text-muted">Please quote {{ number }} as the reference.</span>
        </div>
        <div class="flex flex-col gap-[0.25em]">
          <span class="text-[0.857em] tracking-[0.08em] uppercase" :style="{ color: labelColour }">Notes</span>
          <span class="whitespace-pre-line text-ink-2">{{ notes || '—' }}</span>
          <span v-if="isBold && account.address" class="text-muted">{{ account.address }}</span>
        </div>
      </footer>
    </div>
  </article>
</template>
