import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: { "gridkit-react": resolve(__dirname, "../src/index.ts") },
  },
  server: { port: 5173 },
  build: { outDir: resolve(__dirname, "dist"), emptyOutDir: true },
});
