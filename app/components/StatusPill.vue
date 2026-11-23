<script setup lang="ts">
import type { CustomerStage, InvoiceStatus } from '#shared/types/domain'
import { STAGE_STYLE, STATUS_STYLE } from '#shared/utils/format'

const props = defineProps<{ status?: InvoiceStatus, stage?: CustomerStage }>()
const style = computed(() => (props.stage
  ? STAGE_STYLE[props.stage]
  : STATUS_STYLE[props.status ?? 'draft']))
</script>

<template>
  <span class="inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap" :style="{ background: style.bg, color: style.fg }">{{ style.label }}</span>
</template>
