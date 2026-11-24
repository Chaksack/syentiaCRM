<script setup lang="ts">
// Stroke icons drawn for the Syentia CRM design (24×24 grid, 1.6 stroke).
type IconName = 'dashboard' | 'customers' | 'invoices' | 'projects' | 'licenses' | 'accounts' | 'team' | 'plus' | 'search' | 'updown' | 'back' | 'next'
  | 'check' | 'close' | 'more' | 'trash' | 'download' | 'logout'

const props = withDefaults(defineProps<{ name: IconName, size?: number, strokeWidth?: number }>(), { size: 16, strokeWidth: 1.6 })
</script>

<script lang="ts">
const ICONS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
  invoices: '<path d="M6 2.5h9l4 4V21.5H6z"/><path d="M14.5 2.5v4.5H19M9 12h7M9 16h5"/>',
  projects: '<path d="M3 6.5A1.5 1.5 0 014.5 5H9l2 2.5h8.5A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z"/><path d="M3 11h18"/>',
  licenses: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 9h6M7 12.5h3.5"/><circle cx="16.5" cy="11" r="2"/><path d="M15.3 17v4l1.2-.9 1.2.9v-4"/>',
  accounts: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h3"/>',
  team: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.9-3.6 3.6-5.5 7-5.5s6.1 1.9 7 5.5"/><path d="M19 3v5M16.5 5.5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  updown: '<path d="M7 10l5-5 5 5M7 14l5 5 5-5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
}
</script>

<template>
  <svg
    :width="props.size" :height="props.size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    :stroke-width="props.strokeWidth" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    v-html="ICONS[props.name]"
  />
</template>
