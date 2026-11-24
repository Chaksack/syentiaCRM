<script setup lang="ts">
import type { CustomerStage, InvoiceStatus, LicenseStatus, ProjectStatus } from '#shared/types/domain'
import { LICENSE_STATUS_STYLE, PROJECT_STATUS_STYLE, STAGE_STYLE, STATUS_STYLE } from '#shared/utils/format'

const props = defineProps<{ status?: InvoiceStatus, stage?: CustomerStage, license?: LicenseStatus, project?: ProjectStatus }>()
const style = computed(() => {
  if (props.stage)
    return STAGE_STYLE[props.stage]
  if (props.license)
    return LICENSE_STATUS_STYLE[props.license]
  if (props.project)
    return PROJECT_STATUS_STYLE[props.project]
  return STATUS_STYLE[props.status ?? 'draft']
})
</script>

<template>
  <span class="inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap" :style="{ background: style.bg, color: style.fg }">{{ style.label }}</span>
</template>
