<script setup lang="ts">
/**
 * Syentia brand. `compact`: the S mark + SYENTIA wordmark for the sidebar. `full`: the official
 * lockup (mark | wordmark) for sign-in pages. Both are followed by a small "CRM" tag.
 */
withDefaults(defineProps<{ variant?: 'compact' | 'full' }>(), { variant: 'compact' })
</script>

<template>
  <span v-if="variant === 'compact'" class="inline-flex items-center gap-2.5">
    <img src="/brand/syentia-mark.svg" alt="" class="h-[26px] w-auto shrink-0" width="18" height="26">
    <img src="/brand/syentia-wordmark.png" alt="Syentia" class="h-[13px] w-auto" width="86" height="13">
    <span class="rounded-sm bg-[#262262] px-1 py-px text-[10px] leading-[14px] font-medium tracking-[0.06em] text-white">CRM</span>
  </span>
  <span v-else class="inline-flex flex-col items-center gap-2">
    <img src="/brand/syentia-logo.png" alt="Syentia" class="h-24 w-auto" width="225" height="96">
    <span class="text-[12px] font-medium tracking-[0.2em] text-[#262262]">CRM</span>
  </span>
</template>
