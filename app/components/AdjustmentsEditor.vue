<script setup lang="ts">
import type { Adjustment, AdjustmentKind } from '#shared/types/domain'
import { ADJUSTMENT_PRESETS, formatMoney, parseMoney } from '#shared/utils/format'

/**
 * Discounts, taxes & levies and deductions as editable rows. Keeps its own text state (so typing
 * "1,2" into an amount isn't reformatted under the cursor) and emits parsed adjustments.
 */
const props = withDefaults(defineProps<{ currency?: string, emptyText?: string }>(), { currency: 'GHS', emptyText: 'No discounts, taxes or deductions.' })
const model = defineModel<Adjustment[]>({
  default: () => [],
})

interface Row { key: number, kind: AdjustmentKind, label: string, mode: 'percent' | 'fixed', value: string }

const KIND_INFO: Record<AdjustmentKind, { name: string, placeholder: string, sign: string }> = {
  discount: { name: 'Discount', placeholder: 'Discount', sign: '−' },
  tax: { name: 'Tax / levy', placeholder: 'e.g. VAT', sign: '+' },
  deduction: { name: 'Deduction', placeholder: 'e.g. Withholding tax', sign: '−' },
}

let nextKey = 0
function toRow(a: Adjustment): Row {
  return {
    key: nextKey++,
    kind: a.kind,
    label: a.label,
    mode: a.mode,
    value: a.mode === 'percent'
      ? String(a.value)
      : (a.value
          ? formatMoney(a.value)
          : ''),
  }
}
const rows = ref<Row[]>(model.value.map(toRow))

function parse(row: Row): { adjustment: Adjustment, invalid: boolean } {
  const n = row.mode === 'percent'
    ? Number.parseFloat(row.value.replace(/[%\s]/g, ''))
    : parseMoney(row.value)
  const empty = row.value.trim() === ''
  const invalid = !empty && (Number.isNaN(n) || n < 0 || (row.mode === 'percent' && n > 100))
  return {
    adjustment: {
      kind: row.kind,
      label: row.label,
      mode: row.mode,
      value: invalid || empty
        ? 0
        : n,
    },
    invalid,
  }
}
const parsed = computed(() => rows.value.map(parse))

let lastEmitted = JSON.stringify(model.value)
watch(parsed, (list) => {
  const next = list.map(p => p.adjustment)
  lastEmitted = JSON.stringify(next)
  model.value = next
}, { deep: true })
// Replaced from outside (switching account, discarding changes) → rebuild the rows.
watch(model, (value) => {
  if (JSON.stringify(value) !== lastEmitted) {
    lastEmitted = JSON.stringify(value)
    rows.value = value.map(toRow)
  }
}, { deep: true })

const presetById = Object.fromEntries(ADJUSTMENT_PRESETS.flatMap(g => g.options).map(o => [o.id, o]))
function addPreset(event: Event) {
  const select = event.target as HTMLSelectElement
  const preset = presetById[select.value]
  select.value = ''
  if (preset) {
    rows.value = [
      ...rows.value,
      ...preset.adjustments.map(toRow),
    ]
  }
}

function setMode(row: Row, mode: Row['mode']) {
  if (row.mode !== mode) {
    row.mode = mode
    row.value = ''
  }
}
function remove(key: number) {
  rows.value = rows.value.filter(r => r.key !== key)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="rows.length" class="flex flex-col gap-1.5">
      <div
        v-for="(row, i) in rows" :key="row.key"
        class="flex flex-wrap items-center gap-2 rounded border border-line bg-paper px-2.5 py-2"
      >
        <span
          class="w-[86px] shrink-0 rounded-full px-2 py-0.5 text-center text-[11px]"
          :class="row.kind === 'tax' ? 'bg-surface-3 text-ink' : row.kind === 'discount' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'"
        >{{ KIND_INFO[row.kind].sign }} {{ KIND_INFO[row.kind].name }}</span>
        <input
          v-model="row.label" class="input input-sm min-w-[120px] flex-1" :placeholder="KIND_INFO[row.kind].placeholder"
          :aria-label="`${KIND_INFO[row.kind].name} ${i + 1} name`" maxlength="60"
        >
        <input
          v-model="row.value" inputmode="decimal" class="input input-sm tabular !w-28 text-right"
          :class="parsed[i]?.invalid ? '!border-danger' : ''" :aria-invalid="parsed[i]?.invalid"
          :placeholder="row.mode === 'percent' ? '0' : '0.00'" :aria-label="`${KIND_INFO[row.kind].name} ${i + 1} ${row.mode === 'percent' ? 'rate in percent' : `amount in ${props.currency}`}`"
        >
        <div role="group" :aria-label="`${KIND_INFO[row.kind].name} ${i + 1} type`" class="flex overflow-hidden rounded border border-border">
          <button
            type="button" class="min-h-9 cursor-pointer border-0 px-2.5 text-[12px]" :aria-pressed="row.mode === 'percent'"
            :class="row.mode === 'percent' ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-surface-2'" @click="setMode(row, 'percent')"
          >
            %
          </button>
          <button
            type="button" class="min-h-9 cursor-pointer border-0 border-l border-border px-2.5 text-[12px]" :aria-pressed="row.mode === 'fixed'"
            :class="row.mode === 'fixed' ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-surface-2'" @click="setMode(row, 'fixed')"
          >
            {{ props.currency }}
          </button>
        </div>
        <button
          type="button" class="flex size-8 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-muted hover:bg-surface-2 hover:text-ink"
          :aria-label="`Remove ${row.label || KIND_INFO[row.kind].name}`" @click="remove(row.key)"
        >
          <AppIcon name="close" :size="14" />
        </button>
      </div>
    </div>
    <p v-else class="m-0 text-[13px] text-muted">
      {{ emptyText }}
    </p>

    <label class="self-start">
      <span class="sr-only">Add a discount, tax or deduction</span>
      <select class="min-h-10 cursor-pointer rounded border border-dashed border-border bg-transparent px-3.5 text-[14px] text-ink hover:bg-surface" @change="addPreset">
        <option value="">+ Add discount, tax or deduction</option>
        <optgroup v-for="g in ADJUSTMENT_PRESETS" :key="g.group" :label="g.group">
          <option v-for="o in g.options" :key="o.id" :value="o.id">{{ o.name }}</option>
        </optgroup>
      </select>
    </label>
  </div>
</template>
