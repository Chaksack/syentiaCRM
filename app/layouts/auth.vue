<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-4 py-12">
    <BrandLogo variant="full" />
    <main class="box-border w-full max-w-[400px] rounded-md border border-line bg-paper p-8">
      <slot />
    </main>
  </div>
</template>
