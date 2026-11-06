import { defineConfig } from "vite";

const allowedHosts = [".trycloudflare.com"];

// preview com strictPort: o script `tunnel` aponta fixo para a 4174.
export default defineConfig({
  server: { host: true, port: 5174, strictPort: false, allowedHosts },
  preview: { host: true, port: 4174, strictPort: true, allowedHosts },
  build: {
    rollupOptions: {
      input: { screen: "screen.html", controller: "controller.html" },
    },
  },
});
