import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    proxy: {
      '/api/google': {
        target: 'https://nlcpjdokfvawlpzyfytx.supabase.co',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace('/api/google', '/functions/v1/kw-google'),
      },
    },
  },
  preview: {
    proxy: {
      '/api/google': {
        target: 'https://nlcpjdokfvawlpzyfytx.supabase.co',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace('/api/google', '/functions/v1/kw-google'),
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    {
      name: 'preload-landing-view',
      transformIndexHtml: {
        order: 'post',
        handler: (_html, { bundle }) => {
          const scripts = new Set<string>(), styles = new Set<string>()
          function collect(file: string) {
            const chunk = bundle?.[file]
            if (chunk?.type !== 'chunk' || chunk.isEntry || scripts.has(file)) return
            scripts.add(file)
            chunk.viteMetadata?.importedCss.forEach((css) => styles.add(css))
            chunk.imports.forEach(collect)
          }
          for (const chunk of Object.values(bundle ?? {}))
            if (chunk.type === 'chunk' && chunk.facadeModuleId?.replaceAll('\\', '/').endsWith('/src/pages/Projects.tsx')) collect(chunk.fileName)
          return [
            ...[...scripts].map((file) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${file}` }, injectTo: 'head-prepend' as const })),
            ...[...styles].map((file) => ({ tag: 'link', attrs: { rel: 'preload', as: 'style', href: `/${file}` }, injectTo: 'head-prepend' as const })),
          ]
        },
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['brand/favicon.svg', 'brand/apple-touch-icon.png'],
      manifest: {
        name: 'SingBuild Workspace',
        short_name: 'SingBuild',
        description: 'Pages, calendar and tasks in one workspace.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/brand/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Workspace', short_name: 'Workspace', url: '/' },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2022', cssMinify: true, manifest: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
