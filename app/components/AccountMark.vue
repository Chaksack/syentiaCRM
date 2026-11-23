<script setup lang="ts">
withDefaults(defineProps<{ mark: string, color: string, size?: number }>(), { size: 30 })
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded text-paper"
    :style="{ width: `${size}px`, height: `${size}px`, background: color, fontSize: `${Math.max(10, Math.round(size * 0.38))}px` }"
    aria-hidden="true"
  >{{ mark }}</span>
</template>
