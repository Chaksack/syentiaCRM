import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint', '@nuxt/fonts'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
    // zod is reached from shared/ through lazily loaded page chunks; bundling it inline keeps
    // Nitro's file tracer from missing it in the production output.
    ssr: {
      noExternal: ['zod'],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Syentia CRM',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: '/favicon.png',
        },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#262262' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  fonts: {
    families: [
      {
        name: 'Inter',
        provider: 'google',
        weights: [400, 500],
      },
    ],
  },

  eslint: {
    config: { standalone: false },
  },

  nitro: {
    experimental: { database: true },
    // Fallback only: when DATABASE_URL is set (Neon), server/utils/db.ts talks to PostgreSQL through
    // its own connection pool. Without it, the app runs on a local SQLite file via `node:sqlite`.
    database: {
      default: {
        connector: 'node-sqlite',
        options: { path: '.data/syentia.sqlite' },
      },
    },
    // Uploaded account logos.
    storage: {
      uploads: { driver: 'fs', base: './.data/uploads' },
    },
  },

  runtimeConfig: {
    // Also read straight from DATABASE_URL (the name Neon and Vercel use).
    databaseUrl: '',
    sessionPassword: '',
    // First-run setup (server/utils/seed.ts) — only used while the database has no users.
    seedAdminEmail: '',
    seedAdminName: '',
    seedAdminPassword: '',
    seedAccountName: 'My company',
    public: {
      siteUrl: 'http://localhost:3000',
    },
  },
})
