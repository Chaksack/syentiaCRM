<script setup lang="ts">
import type { Account } from '#shared/types/domain'

/** The account's uploaded logo, or its coloured mark. `onColour` picks the light version for coloured headers. */
const props = withDefaults(defineProps<{
  account: Pick<Account, 'name' | 'mark' | 'color' | 'logoUrl' | 'logoLightUrl'>
  onColour?: boolean
  size?: number
}>(), { onColour: false, size: 44 })

const src = computed(() => (props.onColour
  ? props.account.logoLightUrl ?? props.account.logoUrl
  : props.account.logoUrl))
</script>

<template>
  <img v-if="src" :src="src" :alt="`${account.name} logo`" :style="{ height: `${size}px`, width: 'auto', maxWidth: `${size * 4}px` }" class="object-contain">
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center rounded font-medium"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.36)}px`,
      background: onColour ? 'rgb(247 247 244 / 0.16)' : account.color,
      color: '#f7f7f4',
      border: onColour ? '1.5px solid rgb(247 247 244 / 0.7)' : '0',
    }"
    role="img" :aria-label="`${account.name} logo`"
  >{{ account.mark }}</span>
</template>
