import { defineConfig } from "drizzle-kit"

import { config } from "./src/common/config.js"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/**/*.table.ts",
  out: "./migrations",
  dbCredentials: {
    url: config.database.url
  }
})
