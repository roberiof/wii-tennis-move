import { defineConfig } from "vite";

const allowedHosts = [".trycloudflare.com"];

export default defineConfig({
  server: { host: true, port: 5174, strictPort: false, allowedHosts },
  preview: { host: true, port: 4174, strictPort: false, allowedHosts },
  build: {
    rollupOptions: {
      input: { screen: "screen.html", controller: "controller.html" },
    },
  },
});
