import { defineProject, mergeConfig } from "vitest/config"

import { baseConfig } from "../../vitest.base.js"

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      name: "i18n"
    }
  })
)
