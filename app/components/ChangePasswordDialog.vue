<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const form = reactive({ currentPassword: '', newPassword: '', confirm: '' })
const error = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    Object.assign(form, { currentPassword: '', newPassword: '', confirm: '' })
    error.value = ''
  }
})

async function save() {
  error.value = ''
  if (form.newPassword !== form.confirm) {
    error.value = 'The new passwords don’t match.'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/auth/password', {
      method: 'POST',
      body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
    })
    open.value = false
    toast.success('Password changed')
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" title="Change password" :width="440">
    <form class="flex flex-col gap-3.5" @submit.prevent="save">
      <label class="field">Current password
        <input v-model="form.currentPassword" class="input" type="password" autocomplete="current-password" required>
      </label>
      <label class="field">New password
        <input v-model="form.newPassword" class="input" type="password" autocomplete="new-password" minlength="8" required>
        <span class="text-xs">At least 8 characters.</span>
      </label>
      <label class="field">Confirm new password
        <input v-model="form.confirm" class="input" type="password" autocomplete="new-password" required>
      </label>
      <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
        {{ error }}
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" @click="open = false">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Saving…' : 'Change password' }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>
