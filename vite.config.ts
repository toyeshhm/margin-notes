import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      input: {
        main: "index.html",
        title: "cards/title.html",
        end: "cards/end.html",
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
