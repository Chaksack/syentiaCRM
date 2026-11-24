<script setup lang="ts">
import type { FollowUp } from '#shared/types/domain'
import { formatDate, formatMoney, monthLong, todayIso } from '#shared/utils/format'

useHead({ title: 'Dashboard · Syentia CRM' })

const { user, can } = useAuth()
const { account, accountId } = useCurrentAccount()
const toast = useToast()

const { data, refresh } = await useFetch('/api/dashboard', {
  query: { account: accountId },
})

const now = todayIso()
const period = `${monthLong(Number(now.slice(5, 7)) - 1)} ${now.slice(0, 4)}`

const chartMax = computed(() => Math.max(1, ...(data.value?.chart ?? []).flatMap(b => [b.invoiced, b.collected])))
function barHeight(value: number) {
  return `${Math.max(value > 0
    ? 2
    : 0, Math.round((value / chartMax.value) * 120))}px`
}
const chartLabel = computed(() => (data.value?.chart ?? [])
  .map(b => `${b.month}: invoiced ${formatMoney(b.invoiced)}, collected ${formatMoney(b.collected)}`)
  .join('; '))

function toneColour(tone: FollowUp['tone']) {
  return tone === 'urgent'
    ? '#c23e00'
    : tone === 'normal'
      ? account.value?.color ?? '#26251e'
      : '#7a7974'
}

// ── Follow-ups ──
const canAddTasks = computed(() => user.value?.role !== 'viewer')
const newTask = reactive({ title: '', dueDate: '' })
const addingTask = ref(false)

async function addTask() {
  if (!newTask.title.trim())
    return
  try {
    await $fetch('/api/tasks', {
      method: 'POST',
      body: { accountId: accountId.value, title: newTask.title, dueDate: newTask.dueDate || null },
    })
    newTask.title = ''
    newTask.dueDate = ''
    addingTask.value = false
    await refresh()
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
}

async function completeTask(taskId: string) {
  try {
    await $fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: { done: true },
    })
    await refresh()
    toast.success('Follow-up done')
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
}
</script>

<template>
  <PageMain :gap="32">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">
          Overview <span class="text-faint">· {{ account?.name }}</span>
        </h1>
        <p class="m-0 text-muted">
          {{ period }} · figures in {{ account?.currency }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink v-if="can('customers.write')" to="/customers?new=1" class="btn">
          Add customer
        </NuxtLink>
        <NuxtLink v-if="can('invoices.write')" to="/invoices/new" class="btn btn-primary">
          <AppIcon name="plus" :size="14" :stroke-width="1.8" />New invoice
        </NuxtLink>
      </div>
    </header>

    <template v-if="data">
      <section
        v-if="can('admin') && data.setupMissing.length"
        class="flex flex-wrap items-center justify-between gap-4 rounded bg-surface-2 px-6 py-5"
      >
        <div class="flex flex-col gap-0.5">
          <h2 class="m-0 text-[16px] font-medium">
            Finish setting up {{ data.account.name }}
          </h2>
          <span class="text-[13px] text-ink-2">Add your {{ data.setupMissing.join(', ') }} so they appear on invoices.</span>
        </div>
        <NuxtLink to="/accounts" class="btn btn-sm !min-h-10">
          Accounts &amp; branding
        </NuxtLink>
      </section>

      <section aria-label="Key figures" class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        <div v-for="k in data.kpis" :key="k.label" class="flex flex-col gap-2.5 rounded bg-surface p-5">
          <span class="text-[13px] text-muted">{{ k.label }}</span>
          <span class="tabular text-[26px] leading-[1.1] tracking-[-0.02em]">{{ k.money ? formatMoney(k.value) : k.value }}</span>
          <span class="text-xs text-muted">{{ k.note }}</span>
        </div>
      </section>

      <div class="flex flex-wrap items-stretch gap-2.5">
        <section class="flex min-w-0 flex-[3_1_520px] flex-col gap-4 rounded border border-line p-6">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 class="section-title">
              Recent invoices
            </h2>
            <NuxtLink to="/invoices" class="text-[13px]">
              View all →
            </NuxtLink>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table w-full min-w-[520px]">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th class="text-right">
                    Amount
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.recentInvoices" :key="r.id">
                  <td class="tabular">
                    <NuxtLink :to="`/invoices/${r.id}`" class="text-ink underline decoration-border underline-offset-4 hover:text-ink">
                      {{ r.number }}
                    </NuxtLink>
                  </td>
                  <td>{{ r.customerName ?? '—' }}</td>
                  <td class="text-muted">
                    {{ formatDate(r.dueDate) }}
                  </td>
                  <td class="tabular text-right">
                    {{ formatMoney(r.total, r.currency === account?.currency ? undefined : r.currency) }}
                  </td>
                  <td><StatusPill :status="r.status" /></td>
                </tr>
                <tr v-if="!data.recentInvoices.length">
                  <td colspan="5" class="py-8 text-center text-muted">
                    No invoices yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="flex min-w-0 flex-[2_1_320px] flex-col gap-2.5">
          <div class="flex flex-col gap-[18px] rounded bg-surface p-6">
            <div class="flex flex-col gap-0.5">
              <h2 class="section-title">
                Invoiced vs collected
              </h2>
              <span class="text-xs text-muted">Last 6 months</span>
            </div>
            <div role="img" :aria-label="`Bar chart. ${chartLabel}`" class="flex h-[140px] items-end justify-between gap-2 border-b border-ink/15">
              <div v-for="b in data.chart" :key="b.month" class="flex flex-1 flex-col items-center">
                <div class="flex h-[120px] items-end gap-[3px]">
                  <div class="w-3 rounded-t-sm bg-border" :style="{ height: barHeight(b.invoiced) }" :title="`Invoiced ${formatMoney(b.invoiced)}`" />
                  <div class="w-3 rounded-t-sm" :style="{ height: barHeight(b.collected), background: account?.color }" :title="`Collected ${formatMoney(b.collected)}`" />
                </div>
              </div>
            </div>
            <div class="-mt-3 flex justify-between text-[11px] text-muted">
              <span v-for="b in data.chart" :key="b.month" class="flex-1 text-center">{{ b.month }}</span>
            </div>
            <div class="flex gap-4 text-xs text-muted">
              <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-border" />Invoiced</span>
              <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" :style="{ background: account?.color }" />Collected</span>
            </div>
          </div>

          <div class="flex flex-col gap-3 rounded border border-line p-6">
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="section-title">
                Follow-ups
              </h2>
              <button v-if="canAddTasks && !addingTask" type="button" class="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-accent hover:text-accent-strong" @click="addingTask = true">
                + Add
              </button>
            </div>
            <form v-if="addingTask" class="flex flex-col gap-2 rounded bg-surface p-3" @submit.prevent="addTask">
              <label class="field">
                <span class="sr-only">Follow-up</span>
                <input v-model="newTask.title" class="input input-sm" placeholder="e.g. Call back about renewal" required autofocus>
              </label>
              <div class="flex flex-wrap items-center gap-2">
                <label class="field flex-1">
                  <span class="sr-only">Due date</span>
                  <input v-model="newTask.dueDate" class="input input-sm" type="date">
                </label>
                <button type="button" class="btn btn-sm btn-ghost" @click="addingTask = false">
                  Cancel
                </button>
                <button type="submit" class="btn btn-sm btn-primary">
                  Add
                </button>
              </div>
            </form>
            <div v-for="t in data.followUps" :key="t.id" class="flex items-start gap-3 border-b border-line pb-3">
              <span class="mt-2 size-1.5 shrink-0 rounded-full" :style="{ background: toneColour(t.tone) }" />
              <span class="flex flex-1 flex-col gap-0.5">
                <NuxtLink v-if="t.href" :to="t.href" class="text-ink hover:underline">{{ t.title }}</NuxtLink>
                <span v-else>{{ t.title }}</span>
                <span class="text-xs text-muted">{{ t.meta }}</span>
              </span>
              <button
                v-if="t.taskId && canAddTasks" type="button"
                class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-transparent text-muted hover:bg-surface-2 hover:text-ink"
                :aria-label="`Mark “${t.title}” done`" @click="completeTask(t.taskId)"
              >
                <AppIcon name="check" :size="14" />
              </button>
            </div>
            <p v-if="!data.followUps.length" class="m-0 text-[13px] text-muted">
              Nothing to chase. Nice.
            </p>
          </div>
        </section>
      </div>
    </template>
  </PageMain>
</template>
