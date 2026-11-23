/** The account the sidebar switcher has selected — remembered in a cookie so SSR renders the same one. */
export function useCurrentAccount() {
  const { accounts } = useAuth()
  const selected = useCookie<string | null>('syentia_account', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

  const account = computed(() => accounts.value.find(a => a.id === selected.value) ?? accounts.value[0] ?? null)
  const accountId = computed(() => account.value?.id ?? '')

  function setAccount(id: string) {
    selected.value = id
  }

  return {
    account,
    accountId,
    accounts,
    setAccount,
  }
}
