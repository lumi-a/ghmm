import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/ghmm/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          codemirror: ["codemirror", "@codemirror/lang-javascript"],
          mlmatrix: ["ml-matrix"],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
