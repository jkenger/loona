import { defineConfig } from "@tanstack/react-start/config"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  server: {
    preset: "node-server",
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "Loona - Loan Management",
          short_name: "Loona",
          description: "Track loans, collect payments, and manage your lending business — all in one place.",
          theme_color: "#1a8cff",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/logo192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/logo512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: null,
        },
      }),
    ],
  },
})
