import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // localhost only: the dev server proxies to Flask in debug mode, whose
    // tracebacks should not be reachable from the LAN. Opt in to LAN access
    // with `npm run dev -- --host`.
    host: 'localhost',
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      }
    }
  }
});
