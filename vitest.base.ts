import { defineProject } from "vitest/config"

export const baseConfig = defineProject({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"]
  }
})
