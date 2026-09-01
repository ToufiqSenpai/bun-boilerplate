import { Elysia, NotFoundError } from "elysia"
import { z } from "zod"

import { logger } from "./logger.js"

export const internalServerErrorSchema = z
  .object({
    message: z.literal("Internal Server Error").describe("Internal Server Error")
  })
  .describe("Generic internal server error response")

export const notFoundSchema = z
  .object({
    message: z.string().describe("Not Found message")
  })
  .describe("Not found response")

export const errorPlugin = new Elysia({ name: "error" })
  .guard({
    as: "global",
    response: {
      500: internalServerErrorSchema
    }
  })
  .onError({ as: "global" }, ({ code, error, request, status }) => {
    if (code === "NOT_FOUND" && error instanceof NotFoundError) {
      // SAFETY: 404 intentionally not declared in global guard; routes document it per-endpoint via notFoundSchema
      return status(404 as never, { message: error.message } as never)
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

      return status(500, {
        message: "Internal Server Error"
      })
    }

    return undefined
  })
