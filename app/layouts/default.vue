<template>
  <div class="flex min-h-screen flex-wrap bg-paper">
    <AppSidebar />
    <div class="flex min-w-0 flex-[999_1_560px] flex-col">
      <slot />
    </div>
    <AppToaster />
  </div>
</template>
