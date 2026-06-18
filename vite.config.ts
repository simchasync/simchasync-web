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
        description: "Events management for Artists",
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
    // hls.js (~509 kB) is intentionally large and lazy-loaded on demand for the
    // background video, so it never blocks initial load — keep the warning off
    // the noise floor while still flagging any new oversized eager chunk.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Group the heaviest third-party libs into stable, named vendor chunks
        // so they stay cached across deploys (app code changes far more often).
        // React itself is left to the default chunking + `dedupe` above.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) return "charts";
          if (id.includes("@mui") || id.includes("@emotion")) return "mui";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("/motion") || id.includes("framer-motion")) return "motion";
        },
      },
    },
  },
}));