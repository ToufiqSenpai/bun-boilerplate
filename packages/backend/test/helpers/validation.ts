import type { z } from "zod"

import type { validationErrorSchema } from "../../src/common/error.js"

export type ValidationIssue = z.output<typeof validationErrorSchema>["errors"][number]

export type ValidationErrorPayload = z.output<typeof validationErrorSchema>

export interface EdenValidationError {
  status: number
  value: ValidationErrorPayload
}

export interface EdenApiError<T> {
  status: number
  value: T
}
