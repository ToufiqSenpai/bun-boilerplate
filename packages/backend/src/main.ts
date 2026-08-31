import "./instrument.js"
import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import * as Sentry from "@sentry/elysia"
import { Elysia } from "elysia"
import { z } from "zod"

import { config } from "./common/config.js"
import { errorPlugin } from "./common/error.js"
import { localePlugin } from "./common/i18n.js"
import { logger } from "./common/logger.js"
import { articlePlugin } from "./modules/article/index.js"
import { authPlugin } from "./modules/auth/index.js"

export const app = Sentry.withElysia(new Elysia({ name: "app" }))
  .resolve(({}) => {})
  .use(
    openapi({
      enabled: config.app.environment === "development",
      path: "/api",
      documentation: {
        info: { title: config.app.name, version: "1.0.0" }
      },
      mapJsonSchema: { zod: (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input" }) }
    })
  )
  .use(
    cors({
      origin: config.app.origins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Locale", "Accept-Language"],
      exposeHeaders: ["Content-Language"]
    })
  )
  .use(errorPlugin)
  .use(localePlugin)
  .group("/api", app => app.use(authPlugin).use(articlePlugin))

if (import.meta.main && config.app.environment !== "test") {
  app.listen(config.app.port)
  logger.info(`Server started at ${config.app.baseURL}`)
}

export type App = typeof app
