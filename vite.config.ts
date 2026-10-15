/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backend = process.env.VITE_DEV_BACKEND ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En développement, le proxy garde l'API sur la même origine (cookie de rafraîchissement SameSite=Lax).
    proxy: { "/api": backend, "/media": backend },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("leaflet")) return "map";
          if (id.includes("node_modules/react") || id.includes("react-router") || id.includes("@tanstack")) return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: { include: ["src/**/*.{ts,tsx}"], exclude: ["src/test/**", "src/main.tsx", "src/**/*.d.ts"] },
  },
});
