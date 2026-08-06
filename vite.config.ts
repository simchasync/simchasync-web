import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-192.png", "pwa-512.png"],
      devOptions: { enabled: false },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "SimchaSync",
        short_name: "SimchaSync",
        description: "Booking and event management for simcha musicians and entertainers.",
        theme_color: "#c5922e",
        background_color: "#1a1e2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    // Vite's default modulePreload injects <link rel="modulepreload"> for every
    // chunk reachable via dynamic import from the entry — including route-only
    // chunks like mui/charts/hls that the landing page never touches. That
    // forces ~700KB of dashboard-only code to download on first paint of every
    // route. Disabling it lets lazy()-loaded route chunks load only when their
    // route is actually visited, which is the point of code-splitting them.
    modulePreload: false,
    // hls.js (~509 kB) is intentionally large and lazy-loaded on demand for the
    // background video, so it never blocks initial load — keep the warning off
    // the noise floor while still flagging any new oversized eager chunk.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // mui/recharts are only used by lazy()-loaded /app routes (see App.tsx).
        // Forcing them into named vendor chunks via manualChunks made the entry
        // bundle eagerly import those chunks too — both libs `require()` react
        // internally (CJS interop), and whichever chunk ends up owning that
        // shared CJS wrapper becomes a hard dependency of every importer,
        // including the entry's own need for `createRoot`. Leaving them to
        // Rolldown's default per-route chunking keeps them self-contained
        // inside their own lazy route's chunk graph instead.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("/motion") || id.includes("framer-motion")) return "motion";
        },
      },
    },
  },
}));