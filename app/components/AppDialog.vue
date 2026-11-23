<script setup lang="ts">
/** Native modal <dialog>: focus trapping, Esc to close and the backdrop come from the browser. */
const props = withDefaults(defineProps<{ title: string, description?: string, width?: number }>(), { width: 560 })
const open = defineModel<boolean>('open', { default: false })
const el = ref<HTMLDialogElement>()

watch(open, (value) => {
  if (!el.value)
    return
  if (value && !el.value.open)
    el.value.showModal()
  else if (!value && el.value.open)
    el.value.close()
}, { flush: 'post' })

onMounted(() => {
  if (open.value)
    el.value?.showModal()
})
</script>

<template>
  <dialog
    ref="el"
    class="m-auto w-[calc(100%-32px)] rounded-md border border-line bg-paper p-0 text-ink shadow-[0_20px_60px_rgb(38_37_30/0.25)] backdrop:bg-ink/30"
    :style="{ maxWidth: `${props.width}px` }"
    :aria-label="title"
    @close="open = false"
  >
    <div class="flex flex-col gap-5 p-6">
      <header class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="m-0 text-[22px] leading-tight font-normal tracking-[-0.01em]">
            {{ title }}
          </h2>
          <p v-if="description" class="m-0 text-[13px] text-muted">
            {{ description }}
          </p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm !min-h-9 !w-9 !p-0" aria-label="Close" @click="open = false">
          <AppIcon name="close" />
        </button>
      </header>
      <slot />
    </div>
  </dialog>
</template>
