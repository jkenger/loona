import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    nitro(),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    alias: {
      // Ensure consistent resolution for @noble/ciphers subpath imports
      '@noble/ciphers/chacha': '@noble/ciphers/chacha.js',
      '@noble/ciphers/utils': '@noble/ciphers/utils.js',
    },
  },
  ssr: {
    // Ensure @noble/ciphers is bundled, not externalized
    noExternal: ['@noble/ciphers'],
  },
})

export default config
