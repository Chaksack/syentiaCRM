<script setup lang="ts">
definePageMeta({ permission: 'invoices.write' })
useHead({ title: 'New invoice · Syentia CRM' })

const route = useRoute()
const { accountId } = useCurrentAccount()
const error = ref('')

// Drafts are real records (numbered from the account) so the editor can autosave from the first keystroke.
onMounted(async () => {
  try {
    const { invoice } = await $fetch('/api/invoices', {
      method: 'POST',
      body: {
        accountId: typeof route.query.account === 'string'
          ? route.query.account
          : accountId.value,
        customerId: typeof route.query.customer === 'string'
          ? route.query.customer
          : null,
      },
    })
    await navigateTo(`/invoices/${invoice!.id}`, { replace: true })
  }
  catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <PageMain>
    <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-4 py-3 text-danger">
      {{ error }} <NuxtLink to="/invoices">
        Back to invoices
      </NuxtLink>
    </p>
    <p v-else class="m-0 text-muted">
      Starting a new draft…
    </p>
  </PageMain>
</template>
