<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in · Syentia CRM' })

const route = useRoute()
const { refresh } = useAuth()
const form = reactive({ email: '', password: '' })
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
    await refresh()
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/')
      ? route.query.next
      : '/'
    await navigateTo(next)
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
  <form class="flex flex-col gap-5" @submit.prevent="submit">
    <div class="flex flex-col gap-1">
      <h1 class="m-0 text-[26px] font-normal tracking-[-0.02em]">
        Sign in
      </h1>
      <p class="m-0 text-muted">
        Use your work email.
      </p>
    </div>
    <label class="field">Email
      <input v-model="form.email" class="input" type="email" autocomplete="username" required autofocus>
    </label>
    <label class="field">Password
      <input v-model="form.password" class="input" type="password" autocomplete="current-password" required>
    </label>
    <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
      {{ error }}
    </p>
    <button type="submit" class="btn btn-primary w-full" :disabled="pending">
      {{ pending ? 'Signing in…' : 'Sign in' }}
    </button>
  </form>
</template>
