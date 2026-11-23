<script setup lang="ts">
withDefaults(defineProps<{ gap?: number }>(), { gap: 24 })
</script>

<template>
  <main class="box-border flex flex-col px-[clamp(20px,4vw,56px)] pt-10 pb-16" :style="{ gap: `${gap}px` }">
    <slot />
  </main>
</template>
