import { Elysia } from "elysia"

import { createHealthPlugin, databaseCheck, isHealthProbeRoute } from "./health.js"

function buildApp(checks: Record<string, () => Promise<boolean>>) {
  return new Elysia().use(createHealthPlugin(checks))
}

describe("healthPlugin liveness", () => {
  test("returns 200 alive regardless of failing checks", async () => {
    const app = buildApp({
      database: () => Promise.resolve(false)
    })

    const res = await app.handle(new Request("http://localhost/health/live"))
    // SAFETY: health body is { status: string }
    const body = (await res.json()) as { status: string }

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
    // SAFETY: health body is { status: string }
    const body = (await res.json()) as { status: string }

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "ready" })
  })

  test("returns 503 unavailable when a check resolves false", async () => {
    const app = buildApp({
      database: () => Promise.resolve(false)
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    // SAFETY: health body is { status: string }
    const body = (await res.json()) as { status: string }

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  })

  test("returns 503 unavailable when a check throws", async () => {
    const app = buildApp({
      database: () => Promise.reject(new Error("connection refused"))
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    // SAFETY: health body is { status: string }
    const body = (await res.json()) as { status: string }

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  })

  test("returns 503 unavailable when a check never resolves (deadline)", async () => {
    const app = buildApp({
      database: () => new Promise<boolean>(() => {})
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    // SAFETY: health body is { status: string }
    const body = (await res.json()) as { status: string }

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  }, 10000)

  test("returns 503 unavailable when any of several checks fails", async () => {
    const app = buildApp({
      cache: () => Promise.resolve(true),
      database: () => Promise.resolve(false)
    })

    const res = await app.handle(new Request("http://localhost/health/ready"))
    // SAFETY: health body is { status: string }
    const body = (await res.json()) as { status: string }

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: "unavailable" })
  })
})

describe("databaseCheck", () => {
  test("passes against the test-time database", async () => {
    await expect(databaseCheck()).resolves.toBe(true)
  })
})

describe("isHealthProbeRoute", () => {
  test("matches both health paths", () => {
    expect(isHealthProbeRoute("/health/live")).toBe(true)
    expect(isHealthProbeRoute("/health/ready")).toBe(true)
  })

  test("matches sampler-shaped inputs for both health paths", () => {
    expect(isHealthProbeRoute("GET /health/live")).toBe(true)
    expect(isHealthProbeRoute("GET /health/ready")).toBe(true)
    expect(isHealthProbeRoute("http://127.0.0.1:8080/health/ready")).toBe(true)
    expect(isHealthProbeRoute("/health/ready?foo=bar")).toBe(true)
  })

  test("rejects arbitrary routes", () => {
    expect(isHealthProbeRoute("/api/articles")).toBe(false)
    expect(isHealthProbeRoute("/health")).toBe(false)
    expect(isHealthProbeRoute("/")).toBe(false)
  })
})
