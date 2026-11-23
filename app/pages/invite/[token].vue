<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Join Syentia CRM' })

const route = useRoute()
const token = computed(() => String(route.params.token))
const { refresh } = useAuth()
const { data: invite, error: loadError } = await useFetch(() => `/api/auth/invite/${token.value}`)

const password = ref('')
const confirm = ref('')
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  if (password.value !== confirm.value) {
    error.value = 'The passwords don’t match.'
    return
  }
  pending.value = true
  try {
    await $fetch(`/api/auth/invite/${token.value}`, {
      method: 'POST',
      body: { password: password.value },
    })
    await refresh()
    await navigateTo('/')
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div v-if="loadError" class="flex flex-col gap-3">
    <h1 class="m-0 text-[26px] font-normal tracking-[-0.02em]">
      Invite unavailable
    </h1>
    <p class="m-0 text-muted">
      {{ errorMessage(loadError) }}
    </p>
    <NuxtLink to="/login" class="btn">
      Go to sign in
    </NuxtLink>
  </div>
  <form v-else-if="invite" class="flex flex-col gap-5" @submit.prevent="submit">
    <div class="flex flex-col gap-1">
      <h1 class="m-0 text-[26px] font-normal tracking-[-0.02em]">
        Welcome, {{ invite.name.split(' ')[0] }}
      </h1>
      <p class="m-0 text-muted">
        Choose a password for {{ invite.email }}.
      </p>
    </div>
    <label class="field">New password
      <input v-model="password" class="input" type="password" autocomplete="new-password" minlength="8" required>
      <span class="text-xs">At least 8 characters.</span>
    </label>
    <label class="field">Confirm password
      <input v-model="confirm" class="input" type="password" autocomplete="new-password" required>
    </label>
    <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
      {{ error }}
    </p>
    <button type="submit" class="btn btn-primary w-full" :disabled="pending">
      {{ pending ? 'Setting up…' : 'Join the team' }}
    </button>
  </form>
</template>
