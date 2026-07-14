import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@workspace/api-client-react": path.resolve(
        __dirname,
        "src/lib/api-client-mock.ts"
      ),
      "@assets": path.resolve(__dirname, "../../attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },

  root: __dirname,

  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },

  server: {
    port,
    strictPort: true,
    host: true,
  },

  preview: {
    port,
    host: true,
  },
});