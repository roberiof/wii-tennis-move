import { defineConfig } from "vite";

// O AirConsole carrega /screen.html e /controller.html da raiz da URL do jogo.
// allowedHosts: aceita o domínio do Cloudflare Quick Tunnel (HTTPS para o simulador e o iPhone).
const allowedHosts = [".trycloudflare.com"];

export default defineConfig({
  server: { host: true, port: 5173, strictPort: true, allowedHosts },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts },
  build: {
    rollupOptions: {
      input: { screen: "screen.html", controller: "controller.html" },
    },
  },
});
