import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Force Chrome regardless of system default or the shell used to start Vite
process.env.BROWSER = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    open: true,
  },
});
