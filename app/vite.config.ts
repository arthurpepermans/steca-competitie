import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Versie van deze build: de commit op GitHub Actions, lokaal het tijdstip.
const versie = process.env.GITHUB_SHA?.slice(0, 7) ?? new Date().toISOString();

// Schrijft version.json naast de bundel, zodat de app kan zien of er een nieuwere versie online staat.
function versieBestand(): Plugin {
  return {
    name: "versie-bestand",
    apply: "build",
    writeBundle(options) {
      const map = options.dir ?? "dist";
      copyFileSync(resolve(map, "index.html"), resolve(map, "installeren.html"));
      copyFileSync(resolve(map, "index.html"), resolve(map, "clubapp.html"));
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ versie }) });
    },
  };
}

// BASE_PATH: '/steca-competitie/' op GitHub Pages, '/' bij een eigen domein.
export default defineConfig({
  plugins: [react(), versieBestand()],
  base: process.env.BASE_PATH ?? "/steca-competitie/",
  define: { __APP_VERSIE__: JSON.stringify(versie) },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
