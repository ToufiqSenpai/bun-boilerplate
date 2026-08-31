import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: ["packages/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.{ts,tsx}", "**/node_modules/**"]
    }
  }
})
