import "./instrument.js"
import "zod/compile"
import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import * as Sentry from "@sentry/elysia"
import { Elysia } from "elysia"
import { z } from "zod"

import { config } from "./common/config.js"
import { errorPlugin } from "./common/error.js"
import { healthPlugin } from "./common/health.js"
import { localePlugin } from "./common/i18n.js"
import { logger } from "./common/logger.js"
import { articlePlugin, articleTags } from "./modules/article/index.js"
import { authPlugin, authTags } from "./modules/auth/index.js"

export const app = Sentry.withElysia(new Elysia({ name: "app" }))
  .use(
    openapi({
      enabled: config.app.environment === "development",
      path: "/api",
      documentation: {
        info: {
          title: config.app.name,
          version: "1.0.0",
          description: [
            "REST API for the Bun boilerplate backend.",
            "",
            "## Conventions",
            '- Errors use a JSON envelope: `{ "message": string }`.',
            "- Invalid `body`, `query`, `headers`, `params`, or `cookie` return 422 with a `validation` payload listing all issues.",
            "- List endpoints are paginated with `page` and `limit` query parameters and return `{ data, meta }`.",
            "- The response `meta` object echoes `page`, `limit`, `total`, and `totalPages`.",
            "",
            "## Localization",
            "- Translatable resources expose one row per locale. List endpoints select the translation via the `locale` query parameter.",
            "- Request locale is negotiated from the `X-Locale` header first, then `Accept-Language`, then the application default (`en`).",
            "- Responses echo the effective locale in the `Content-Language` header.",
            "",
            "## Authentication",
            "- Session authentication uses the better-auth session cookie (`better-auth.session_token`).",
            "- Protected endpoints require a session whose user holds the documented permission (`superadmin` holds all permissions, `admin` holds content permissions, `user` holds none).",
            "- Email verification is required for new accounts; the first registered user is automatically promoted to `superadmin`.",
            "- The better-auth endpoints mounted under `/api/auth` (sign-in, sign-up, sessions, etc.) are documented by better-auth's own OpenAPI reference, which is enabled in development."
          ].join("\n")
        },
        servers: [{ url: config.app.baseURL, description: `${config.app.environment} server` }],
        tags: [...authTags, ...articleTags],
        components: {
          securitySchemes: {
            sessionCookie: {
              type: "apiKey",
              in: "cookie",
              name: "better-auth.session_token",
              description: "Session cookie issued by better-auth on sign-in"
            }
          }
        }
      },
      mapJsonSchema: {
        zod: (schema: z.ZodType) =>
          z.toJSONSchema(schema, {
            io: "input",
            unrepresentable: "any",
            override: ({ zodSchema, jsonSchema }) => {
              if (zodSchema instanceof z.ZodDate) {
                jsonSchema.type = "string"
                jsonSchema.format = "date-time"
              }
            }
          })
      }
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
  .use(healthPlugin)
  .use(localePlugin)
  .group("/api", app => app.use(authPlugin).use(articlePlugin))

if (import.meta.main && config.app.environment !== "test") {
  app.listen(config.app.port)
  logger.info(`Server started at ${config.app.baseURL}`)
}

export type App = typeof app
