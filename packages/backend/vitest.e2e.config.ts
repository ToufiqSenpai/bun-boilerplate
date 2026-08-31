import { defineProject } from "vitest/config"

import backendConfig from "./vitest.config.js"

export default defineProject({
  ...backendConfig,
  test: {
    ...backendConfig.test,
    name: "backend-e2e",
    include: ["test/**/*.e2e.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    fileParallelism: false
  }
})
