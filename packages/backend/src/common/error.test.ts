import { faker } from "@faker-js/faker"
import { Elysia } from "elysia"

import {
  errorPlugin,
  internalServerErrorSchema,
  notFoundSchema,
  validationErrorSchema,
  validationIssueSchema
} from "./error.js"

describe("errorPlugin", () => {
  describe("generic Error", () => {
    test("returns generic message body", async () => {
      const message = faker.lorem.sentence()
      const error = new Error(message)
      error.name = faker.lorem.word()

      const app = new Elysia().use(errorPlugin).get("/test-path", () => {
        throw error
      })

      const res = await app.handle(new Request("http://localhost/test-path"))
      // SAFETY: 500 error body is { message: "Internal Server Error" }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(500)
      expect(body).toEqual({ message: "Internal Server Error" })
      expect(body).not.toHaveProperty("timestamp")
      expect(body).not.toHaveProperty("exception")
      expect(body).not.toHaveProperty("trace")
      expect(body).not.toHaveProperty("path")
      expect(body).not.toHaveProperty("status")
      expect(body).not.toHaveProperty("error")
    })

    test("returns generic message body when error message is empty", async () => {
      const app = new Elysia().use(errorPlugin).get("/empty", () => {
        throw new Error("")
      })

      const res = await app.handle(new Request("http://localhost/empty"))
      // SAFETY: 500 error body is { message: "Internal Server Error" }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(500)
      expect(body).toEqual({ message: "Internal Server Error" })
    })

    test("returns generic message body in production", async () => {
      const app = new Elysia().use(errorPlugin).get("/prod-path", () => {
        throw new Error(faker.lorem.sentence())
      })

      const res = await app.handle(new Request("http://localhost/prod-path"))
      // SAFETY: production error body is { message: string }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(500)
      expect(body).toEqual({ message: "Internal Server Error" })
    })
  })

  describe("NOT_FOUND", () => {
    test("returns JSON with default NOT_FOUND message for unknown route", async () => {
      const app = new Elysia().use(errorPlugin).get("/exists", () => "ok")

      const res = await app.handle(new Request("http://localhost/unknown"))
      // SAFETY: NotFound body is { message: string }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(404)
      expect(body).toEqual({ message: "NOT_FOUND" })
      expect(res.headers.get("content-type")).toContain("application/json")
    })

    test("returns JSON with the thrown NotFoundError message", async () => {
      const { NotFoundError } = await import("elysia")
      const message = faker.lorem.sentence()
      const app = new Elysia().use(errorPlugin).get("/throw", () => {
        throw new NotFoundError(message)
      })

      const res = await app.handle(new Request("http://localhost/throw"))
      // SAFETY: NotFound body is { message: string }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(404)
      expect(body).toEqual({ message })
    })
  })

  describe("non-generic errors", () => {
    test("does not handle non-Error thrown value", async () => {
      const app = new Elysia()
        .use(errorPlugin)
        .get("/", () => {
          // SAFETY: throwing non-Error to test fallback, intentional for test
          throw "string error" as never
        })
        .onError(({ code }) => {
          if (code === "UNKNOWN") return new Response("fallback", { status: 500 })

          return undefined
        })

      const res = await app.handle(new Request("http://localhost/"))
      expect(res.status).toBe(500)
      expect(await res.text()).toBe("fallback")
    })
  })
})

describe("internalServerErrorSchema", () => {
  test("accepts the generic error shape", () => {
    const result = internalServerErrorSchema.safeParse({ message: "Internal Server Error" })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ message: "Internal Server Error" })
    }
  })

  test("rejects a different message", () => {
    const result = internalServerErrorSchema.safeParse({ message: faker.lorem.sentence() })

    expect(result.success).toBe(false)
  })

  test("rejects a missing message", () => {
    expect(internalServerErrorSchema.safeParse({}).success).toBe(false)
  })

  test("rejects the old dev error shape", () => {
    const devShape = {
      timestamp: new Date().toISOString(),
      exception: faker.lorem.word(),
      message: faker.lorem.sentence(),
      trace: faker.lorem.paragraph(),
      path: `/${faker.lorem.slug()}`
    }

    const result = internalServerErrorSchema.safeParse(devShape)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path.join("."))).toEqual(["message"])
    }
  })

  test("has descriptions on the root and the message field", () => {
    expect(internalServerErrorSchema.description).toBe("Generic internal server error response")
    expect(internalServerErrorSchema.shape.message.description).toBe("Internal Server Error")
  })
})

describe("notFoundSchema", () => {
  test("accepts any string message", () => {
    const message = faker.lorem.sentence()

    const result = notFoundSchema.safeParse({ message })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ message })
    }
  })

  test("accepts the default Elysia NOT_FOUND message", () => {
    expect(notFoundSchema.safeParse({ message: "NOT_FOUND" }).success).toBe(true)
  })

  test("rejects a missing message", () => {
    const result = notFoundSchema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path.join("."))).toEqual(["message"])
    }
  })

  test("rejects a non-string message", () => {
    const result = notFoundSchema.safeParse({ message: faker.number.int() })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path.join("."))).toEqual(["message"])
    }
  })

  test("has descriptions on the root and the message field", () => {
    expect(notFoundSchema.description).toBe("Not found response")
    expect(notFoundSchema.shape.message.description).toBe("Not Found message")
  })
})

interface ValidationIssueOverrides {
  path?: (string | number)[]
  message?: string
  code?: string
  expected?: string
}

interface ValidationErrorOverrides {
  type?: string
  on?: string
  property?: string
  summary?: string
  message?: string
  expected?: unknown
  found?: { locale: string }
  errors?: ValidationIssueOverrides[]
}

function createValidationIssue(overrides: ValidationIssueOverrides = {}) {
  return {
    path: ["name"],
    message: "Name is required",
    code: "custom",
    ...overrides
  }
}

function createValidationErrorPayload(overrides: ValidationErrorOverrides = {}) {
  return {
    type: "validation",
    on: "body",
    property: "name",
    message: "Name is required",
    found: { locale: "en" },
    errors: [createValidationIssue()],
    ...overrides
  }
}

describe("validationIssueSchema", () => {
  test("accepts a minimal issue", () => {
    const result = validationIssueSchema.safeParse(createValidationIssue())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(createValidationIssue())
    }
  })

  test("accepts an issue with expected and extra zod keys", () => {
    const issue = {
      ...createValidationIssue({ code: "invalid_type", expected: "string" }),
      input: null,
      origin: "string"
    }

    const result = validationIssueSchema.safeParse(issue)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.expected).toBe("string")
      expect(result.data).toHaveProperty("input", null)
    }
  })

  test("accepts numeric path segments for array indices", () => {
    const result = validationIssueSchema.safeParse(createValidationIssue({ path: ["data", 0, "slug"] }))

    expect(result.success).toBe(true)
  })

  test("rejects an issue missing code", () => {
    const { code: _ignored, ...withoutCode } = createValidationIssue()

    const result = validationIssueSchema.safeParse(withoutCode)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path.join("."))).toEqual(["code"])
    }
  })

  test("rejects a non-array path", () => {
    const result = validationIssueSchema.safeParse({ ...createValidationIssue(), path: "name" })

    expect(result.success).toBe(false)
  })
})

describe("validationErrorSchema", () => {
  test("accepts the full development payload", () => {
    const payload = createValidationErrorPayload({
      summary: "Slug must be a string",
      expected: { name: "string" }
    })

    const result = validationErrorSchema.safeParse(payload)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(payload)
    }
  })

  test("accepts a payload without optional summary and expected", () => {
    expect(validationErrorSchema.safeParse(createValidationErrorPayload()).success).toBe(true)
  })

  test("accepts every validation location", () => {
    for (const on of ["body", "query", "headers", "params", "cookie"] as const) {
      expect(validationErrorSchema.safeParse(createValidationErrorPayload({ on })).success).toBe(true)
    }
  })

  test("rejects an unknown validation location", () => {
    const result = validationErrorSchema.safeParse(createValidationErrorPayload({ on: "response" }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path.join("."))).toEqual(["on"])
    }
  })

  test("rejects a wrong discriminator type", () => {
    expect(validationErrorSchema.safeParse(createValidationErrorPayload({ type: "server" })).success).toBe(false)
  })

  test("rejects an empty errors array entry that misses required issue fields", () => {
    const result = validationErrorSchema.safeParse(createValidationErrorPayload({ errors: [{ message: "x" }] }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path.join("."))).toEqual(["errors.0.path", "errors.0.code"])
    }
  })

  test("has descriptions on the root and its fields", () => {
    expect(validationErrorSchema.description).toBe(
      "Request validation failed; in production Elysia reduces the body to only type, on, and found"
    )

    const shape = validationErrorSchema.shape
    expect(shape.type.description).toBe('Discriminator, always "validation"')
    expect(shape.on.description).toBe("Request part that failed validation")
    expect(shape.found.description).toBe("The rejected payload as received")
    expect(shape.errors.description).toBe("All validation issues")
  })
})
