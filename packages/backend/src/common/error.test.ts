import { faker } from "@faker-js/faker"
import { Elysia } from "elysia"

import { config } from "./config.js"
import { errorPlugin, internalServerErrorSchema } from "./error.js"

describe("errorPlugin", () => {
  const originalEnvironment = config.app.environment

  afterEach(() => {
    config.app.environment = originalEnvironment
  })

  describe("generic Error", () => {
    test("returns Spring Boot-like body in non-production", async () => {
      config.app.environment = "development"

      const message = faker.lorem.sentence()
      const error = new Error(message)
      error.name = faker.lorem.word()

      const app = new Elysia().use(errorPlugin).get("/test-path", () => {
        throw error
      })

      const res = await app.handle(new Request("http://localhost/test-path"))
      // SAFETY: errorPlugin response shape is known for non-production 500
      const body = (await res.json()) as {
        timestamp: string
        exception: string
        message: string
        trace: string
        path: string
      }

      expect(res.status).toBe(500)
      expect(body.message).toBe(message)
      expect(body.exception).toBe(error.name)
      expect(body.path).toBe("/test-path")
      expect(body.timestamp).toBeDefined()
      expect(() => new Date(body.timestamp)).not.toThrow()
      expect(body.trace).toContain(message)
      expect(body).not.toHaveProperty("status")
      expect(body).not.toHaveProperty("error")
    })

    test("returns only message in production", async () => {
      config.app.environment = "production"

      const app = new Elysia().use(errorPlugin).get("/prod-path", () => {
        throw new Error(faker.lorem.sentence())
      })

      const res = await app.handle(new Request("http://localhost/prod-path"))
      // SAFETY: production error body is { message: string }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(500)
      expect(body).toEqual({ message: "Internal Server Error" })
    })

    test("uses No message available when error message is empty in non-production", async () => {
      config.app.environment = "development"

      const app = new Elysia().use(errorPlugin).get("/empty", () => {
        throw new Error("")
      })

      const res = await app.handle(new Request("http://localhost/empty"))
      // SAFETY: error body contains message
      const body = (await res.json()) as { message: string }

      expect(body.message).toBe("No message available")
    })

    test("includes full stack trace", async () => {
      config.app.environment = "test"

      const app = new Elysia().use(errorPlugin).get("/trace", () => {
        throw new Error(faker.lorem.sentence())
      })

      const res = await app.handle(new Request("http://localhost/trace"))
      // SAFETY: error body contains trace
      const body = (await res.json()) as { trace: string }

      expect(body.trace).toContain("Error")
      expect(body.trace).toContain("at")
    })
  })

  describe("NOT_FOUND", () => {
    test("returns JSON message Not Found for unknown route", async () => {
      const app = new Elysia().use(errorPlugin).get("/exists", () => "ok")

      const res = await app.handle(new Request("http://localhost/unknown"))
      // SAFETY: NotFound body is { message: "Not Found" }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(404)
      expect(body).toEqual({ message: "Not Found" })
      expect(res.headers.get("content-type")).toContain("application/json")
    })

    test("returns JSON message Not Found when throwing NotFoundError", async () => {
      const { NotFoundError } = await import("elysia")
      const app = new Elysia().use(errorPlugin).get("/throw", () => {
        throw new NotFoundError()
      })

      const res = await app.handle(new Request("http://localhost/throw"))
      // SAFETY: NotFound body is { message: "Not Found" }
      const body = (await res.json()) as { message: string }

      expect(res.status).toBe(404)
      expect(body).toEqual({ message: "Not Found" })
    })
  })

  describe("non-generic errors", () => {
    test("does not handle non-Error thrown value", async () => {
      config.app.environment = "development"

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

  describe("internalServerErrorSchema", () => {
    test("validates dev shape in non-production", () => {
      config.app.environment = "development"

      const valid = {
        timestamp: new Date().toISOString(),
        exception: faker.lorem.word(),
        message: faker.lorem.sentence(),
        trace: faker.lorem.paragraph(),
        path: `/${faker.lorem.slug()}`
      }

      expect(internalServerErrorSchema.safeParse(valid).success).toBe(true)
    })

    test("accepts dev shape without trace", () => {
      const valid = {
        timestamp: new Date().toISOString(),
        exception: faker.lorem.word(),
        message: faker.lorem.sentence(),
        path: `/${faker.lorem.slug()}`
      }

      expect(internalServerErrorSchema.safeParse(valid).success).toBe(true)
    })

    test("rejects missing required fields", () => {
      expect(internalServerErrorSchema.safeParse({}).success).toBe(false)
      expect(internalServerErrorSchema.safeParse({ message: faker.lorem.sentence() }).success).toBe(false)
    })

    test("rejects invalid timestamp", () => {
      const invalid = {
        timestamp: faker.lorem.word(),
        exception: faker.lorem.word(),
        message: faker.lorem.sentence(),
        path: `/${faker.lorem.slug()}`
      }

      expect(internalServerErrorSchema.safeParse(invalid).success).toBe(false)
    })
  })
})
