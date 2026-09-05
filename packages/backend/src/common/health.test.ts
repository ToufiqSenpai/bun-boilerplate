import { Elysia } from "elysia"

import { checkReadiness, healthChecks, healthPlugin, isHealthRoute } from "./health.js"
import type { HealthCheck } from "./health.js"

function fakeCheck(name: string, run: () => Promise<boolean>): HealthCheck {
  return { name, check: run }
}

interface HealthBody {
  status: string
}

async function readStatus(res: Response): Promise<HealthBody> {
  // SAFETY: health body is { status: string }
  return (await res.json()) as HealthBody
}

describe("checkReadiness", () => {
  test("returns true when all checks pass", async () => {
    await expect(checkReadiness([fakeCheck("database", () => Promise.resolve(true))])).resolves.toBe(true)
  })

  test("returns false when a check resolves false", async () => {
    await expect(checkReadiness([fakeCheck("database", () => Promise.resolve(false))])).resolves.toBe(false)
  })

  test("returns false when a check throws", async () => {
    await expect(
      checkReadiness([fakeCheck("database", () => Promise.reject(new Error("connection refused")))])
    ).resolves.toBe(false)
  })

  test("returns false when a check never resolves (deadline)", async () => {
    await expect(checkReadiness([fakeCheck("database", () => new Promise<boolean>(() => {}))])).resolves.toBe(false)
  }, 10000)

  test("returns false when any of several checks fails", async () => {
    await expect(
      checkReadiness([
        fakeCheck("cache", () => Promise.resolve(true)),
        fakeCheck("database", () => Promise.resolve(false))
      ])
    ).resolves.toBe(false)
  })
})

describe("healthPlugin", () => {
  test("liveness returns 200 alive", async () => {
    const app = new Elysia().use(healthPlugin)

    const res = await app.handle(new Request("http://localhost/health/live"))
    const body = await readStatus(res)

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "alive" })
  })

  test("readiness returns 200 ready against the test-time database", async () => {
    const app = new Elysia().use(healthPlugin)

    const res = await app.handle(new Request("http://localhost/health/ready"))
    const body = await readStatus(res)

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "ready" })
  })
})

describe("healthChecks", () => {
  test("contains the database check", () => {
    expect(healthChecks.map(check => check.name)).toContain("database")
  })

  test("database check passes against the test-time database", async () => {
    const dbCheck = healthChecks.find(check => check.name === "database")
    // SAFETY: prior test asserts it exists
    await expect(dbCheck!.check()).resolves.toBe(true)
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
