export interface ValidationIssue {
  path: string[]
  message: string
  code: string
  expected?: string
}

export interface ValidationErrorPayload {
  type: "validation"
  on: string
  property: string
  message: string
  found: unknown
  errors: ValidationIssue[]
}

export interface EdenValidationError {
  status: number
  value: ValidationErrorPayload
}
