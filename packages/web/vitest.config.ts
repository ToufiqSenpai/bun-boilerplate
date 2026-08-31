import react from "@vitejs/plugin-react"
import { defineProject, mergeConfig } from "vitest/config"

import { baseConfig } from "../../vitest.base.js"

export default mergeConfig(
  baseConfig,
  defineProject({
    resolve: { tsconfigPaths: true },
    plugins: [react()],
    test: {
      name: "web",
      environment: "jsdom"
    }
  })
)
