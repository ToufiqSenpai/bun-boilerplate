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

export const validationIssueSchema = z.looseObject({
  path: z
    .array(z.union([z.string(), z.number()]))
    .describe("Path to the offending value, e.g. body.name as [body, name]"),
  message: z.string().describe("Human-readable description of the validation failure"),
  code: z.string().describe('Machine-readable issue code, e.g. "invalid_type"'),
  expected: z.string().optional().describe("Expected type or value, when applicable")
})

export const validationErrorSchema = z
  .object({
    type: z.literal("validation").describe('Discriminator, always "validation"'),
    on: z.enum(["body", "query", "headers", "params", "cookie"]).describe("Request part that failed validation"),
    property: z.string().describe("First offending property name"),
    summary: z.string().optional().describe("Short summary of the first issue"),
    message: z.string().describe("Message of the first issue"),
    expected: z.unknown().optional().describe("Expected shape of the payload"),
    found: z.unknown().describe("The rejected payload as received"),
    errors: z.array(validationIssueSchema).describe("All validation issues")
  })
  .describe("Request validation failed; in production Elysia reduces the body to only type, on, and found")

export const errorPlugin = new Elysia({ name: "error" })
  .guard({
    as: "global",
    response: {
      422: validationErrorSchema,
      500: internalServerErrorSchema
    }
  })
  .onError({ as: "global" }, ({ code, error, request, status }) => {
    if (code === "NOT_FOUND" && error instanceof NotFoundError) {
      // SAFETY: 404 intentionally not declared in global guard; routes document it per-endpoint via notFoundSchema
      return status(404 as never, { message: error.message } as never)
    }

    if (code === "UNKNOWN" && error instanceof Error) {
      const path = new URL(request.url).pathname

      logger.error({ err: error, path, exception: error.name }, error.message)

      return status(500, {
        message: "Internal Server Error"
      })
    }

    return undefined
  })
