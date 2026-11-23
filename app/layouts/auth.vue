<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-4 py-12">
    <div class="flex items-center gap-2 text-[20px] tracking-[-0.02em]">
      <span class="inline-block size-5 rounded bg-ink" />
      <span>syentia<span class="text-faint">CRM</span></span>
    </div>
    <main class="box-border w-full max-w-[400px] rounded-md border border-line bg-paper p-8">
      <slot />
    </main>
  </div>
</template>
