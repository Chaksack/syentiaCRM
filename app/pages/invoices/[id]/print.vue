<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { data, error } = await useFetch(() => `/api/invoices/${route.params.id}`)
const invoice = computed(() => data.value?.invoice)
useHead(() => ({
  title: invoice.value
    ? `${invoice.value.number} · ${invoice.value.account.name}`
    : 'Invoice',
  style: [
    { innerHTML: '@page { size: A4; margin: 0 } @media print { html, body { background: #fff !important } }' },
  ],
}))

function print() {
  window.print()
}

onMounted(() => {
  if (route.query.print === '1' && invoice.value)
    setTimeout(() => window.print(), 300)
})
</script>

<template>
  <div class="min-h-screen bg-desk print:bg-white">
    <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3 print:hidden">
      <NuxtLink :to="`/invoices/${route.params.id}`" class="btn btn-sm btn-ghost">
        <AppIcon name="back" :size="14" /> Back
      </NuxtLink>
      <span class="text-[13px] text-muted">A4 · choose “Save as PDF” in the print dialog</span>
      <button type="button" class="btn btn-sm btn-primary" @click="print">
        <AppIcon name="download" :size="14" /> Print / Save PDF
      </button>
    </div>
    <p v-if="error" class="p-8 text-danger">
      {{ errorMessage(error) }}
    </p>
    <div v-else-if="invoice" class="flex justify-center py-8 print:p-0">
      <div class="shadow-[0_12px_40px_rgb(38_37_30/0.18)] print:shadow-none">
        <InvoiceDocument
          :number="invoice.number" :template="invoice.template" :currency="invoice.currency"
          :issue-date="invoice.issueDate" :due-date="invoice.dueDate" :notes="invoice.notes"
          :items="invoice.items" :breakdown="invoice.breakdown"
          :amount-paid="invoice.amountPaid" :account="invoice.account" :customer="invoice.customer"
          size="page"
        />
      </div>
    </div>
  </div>
</template>
