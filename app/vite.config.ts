import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH: '/steca-competitie/' op GitHub Pages, '/' bij een eigen domein.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? "/steca-competitie/",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
