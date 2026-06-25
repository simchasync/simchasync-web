import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Default 5000ms became too tight under full-suite parallel load as the
    // suite grew -- individual waitFor-based tests started timing out under
    // CPU contention even though they pass instantly standalone.
    testTimeout: 15000,
    // @mui/material's internal Transition.mjs does a directory import of
    // react-transition-group (an ESM-incompatible CJS package) -- forcing it
    // through Vite's CJS interop via deps.inline avoids the raw Node ESM
    // resolver choking on the directory import.
    server: {
      deps: {
        inline: ["@mui/material", "react-transition-group"],
      },
    },
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
