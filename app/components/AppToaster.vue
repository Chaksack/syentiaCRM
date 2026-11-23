<script setup lang="ts">
const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2" role="status" aria-live="polite">
    <div
      v-for="t in toasts" :key="t.id"
      class="pointer-events-auto flex max-w-sm items-center gap-3 rounded border px-4 py-3 text-sm shadow-[0_10px_30px_rgb(38_37_30/0.15)]"
      :class="t.tone === 'error' ? 'border-danger/20 bg-danger-bg text-danger' : 'border-line bg-ink text-paper'"
    >
      <AppIcon :name="t.tone === 'error' ? 'close' : 'check'" />
      <span class="flex-1">{{ t.text }}</span>
      <button type="button" class="cursor-pointer border-0 bg-transparent p-1 text-current opacity-70 hover:opacity-100" aria-label="Dismiss" @click="dismiss(t.id)">
        <AppIcon name="close" :size="14" />
      </button>
    </div>
  </div>
</template>
