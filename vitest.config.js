import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    exclude: ["e2e/**", "node_modules/**"],
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/api/**"],
      exclude: ["lib/ai/provider.js", "lib/ai/middleware.js"],
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  esbuild: {
    // Match Next.js's automatic JSX runtime so unit tests can import React
    // components (in .jsx files) without an explicit `import React`.
    jsx: "automatic",
  },
});
