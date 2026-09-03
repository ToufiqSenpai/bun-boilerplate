import { Elysia } from "elysia"

import { createHealthPlugin, databaseCheck, isHealthRoute } from "./health.js"
import type { HealthChecks } from "./health.js"

function buildApp(checks: HealthChecks) {
  return new Elysia().use(createHealthPlugin(checks))
}

interface HealthBody {
  status: string
}

async function readStatus(res: Response): Promise<HealthBody> {
  // SAFETY: health body is { status: string }
  return (await res.json()) as HealthBody
}

describe("healthPlugin liveness", () => {
  test("returns 200 alive regardless of failing checks", async () => {
    const app = buildApp({
      database: () => Promise.resolve(false)
    })

    const res = await app.handle(new Request("http://localhost/health/live"))
    const body = await readStatus(res)

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "alive" })
  })
})

describe("healthPlugin readiness", () => {
  test("returns 200 ready when all checks pass", async () => {
    const app = buildApp({
      database: () => Promise.resolve(true)
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    const body = await readStatus(res)

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "ready" })
  })

  test("returns 503 unavailable when a check resolves false", async () => {
    const app = buildApp({
      database: () => Promise.resolve(false)
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    const body = await readStatus(res)

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  })

  test("returns 503 unavailable when a check throws", async () => {
    const app = buildApp({
      database: () => Promise.reject(new Error("connection refused"))
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    const body = await readStatus(res)

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  })

  test("returns 503 unavailable when a check never resolves (deadline)", async () => {
    const app = buildApp({
      database: () => new Promise<boolean>(() => {})
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    const body = await readStatus(res)

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  }, 10000)

  test("returns 503 unavailable when any of several checks fails", async () => {
    const app = buildApp({
      cache: () => Promise.resolve(true),
      database: () => Promise.resolve(false)
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    const body = await readStatus(res)

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  })
})

describe("databaseCheck", () => {
  test("passes against the test-time database", async () => {
    await expect(databaseCheck()).resolves.toBe(true)
  })
})

describe("isHealthRoute", () => {
  test("matches both health paths", () => {
    expect(isHealthRoute("/health/live")).toBe(true)
    expect(isHealthRoute("/health/ready")).toBe(true)
  })

  test("matches sampler-shaped inputs for both health paths", () => {
    expect(isHealthRoute("GET /health/live")).toBe(true)
    expect(isHealthRoute("GET /health/ready")).toBe(true)
    expect(isHealthRoute("http://127.0.0.1:8080/health/ready")).toBe(true)
    expect(isHealthRoute("/health/ready?foo=bar")).toBe(true)
  })

  test("rejects arbitrary routes", () => {
    expect(isHealthRoute("/api/articles")).toBe(false)
    expect(isHealthRoute("/health")).toBe(false)
    expect(isHealthRoute("/")).toBe(false)
  })
})
