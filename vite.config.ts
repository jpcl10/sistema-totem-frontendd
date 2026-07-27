import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { createHash } from "node:crypto";

const totemV2Build =
  process.env.VITE_BUILD_SHA ||
  process.env.GITHUB_SHA ||
  createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 12);

export default defineConfig({
  define: {
    __TOTEM_V2_BUILD__: JSON.stringify(totemV2Build),
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
  },
});
