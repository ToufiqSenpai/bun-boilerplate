import { Elysia, NotFoundError } from "elysia"
import { z } from "zod"

import { config } from "./config.js"
import { logger } from "./logger.js"
import { timestampSchema } from "./schema.js"

const prodSchema = z.object({
  message: z.literal("Internal Server Error").describe("Internal Server Error")
})

const devSchema = z.object({
  timestamp: timestampSchema.readonly().describe("ISO-8601 timestamp of error"),
  exception: z.string().readonly().describe("Exception class name"),
  message: z.string().readonly().describe("Error message"),
  trace: z.string().readonly().optional().describe("Full stack trace"),
  path: z.string().readonly().describe("Request pathname")
})

export const internalServerErrorSchema = config.app.environment === "production" ? prodSchema : devSchema

export const errorPlugin = new Elysia({ name: "error" })
  .guard({
    as: "global",
    response: {
      500: internalServerErrorSchema
    }
  })
  .onError({ as: "global" }, ({ code, error, request, status }) => {
    if (code === "NOT_FOUND" && error instanceof NotFoundError) {
      // SAFETY: 404 intentionally not declared in guard response per spec (internal handling only, no notFoundSchema)
      return status(404 as never, { message: "Not Found" } as never)
    }

    if (code === "UNKNOWN" && error instanceof Error) {
      const path = (() => {
        try {
          return new URL(request.url).pathname
        } catch {
          return request.url
        }
      })()

      logger.error({ err: error, path, exception: error.name }, error.message)

      const isProduction = config.app.environment === "production"

      if (isProduction) {
        return status(500, {
          message: "Internal Server Error"
        })
      }

      return status(500, {
        timestamp: new Date(),
        exception: error.name,
        message: error.message || "No message available",
        trace: error.stack,
        path
      })
    }

    return undefined
  })
