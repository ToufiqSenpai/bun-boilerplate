import { sql } from "drizzle-orm"
import { Elysia } from "elysia"

import { database } from "./database.js"
import { logger } from "./logger.js"

export const CHECK_TIMEOUT_MS = 1500

export interface HealthCheck {
  readonly name: string
  check(): Promise<boolean>
}

export const healthChecks: HealthCheck[] = [
  {
    name: "database",
    check: async () => {
      await database.execute(sql`SELECT 1`)
      return true
    }
  }
]

export function isHealthRoute(value: string): boolean {
  // ponytail: regex-only route match; a literal path like "GET/health/ready" would false-positive — swap for real URL parsing if that matters
  return /\/health\/(live|ready)([?#].*)?$/u.test(value.trim().replace(/^[A-Z]+\s/u, ""))
}

async function runCheck(check: HealthCheck): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Health check "${check.name}" timed out after ${CHECK_TIMEOUT_MS}ms`))
      }, CHECK_TIMEOUT_MS)
    })
    const passed = await Promise.race([check.check(), timeout])
    if (passed) return true
    logger.warn({ check: check.name }, "Health check failed")
    return false
  } catch (error) {
    logger.warn({ check: check.name, err: error }, "Health check failed")
    return false
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export async function checkReadiness(checks: HealthCheck[]): Promise<boolean> {
  const results = await Promise.all(checks.map(check => runCheck(check)))
  return results.every(passed => passed)
}

export const healthPlugin = new Elysia({ name: "health" })
  .get("/health/live", () => ({ status: "alive" as const }), { detail: { hide: true } })
  .get(
    "/health/ready",
    async ({ set }) => {
      const ready = await checkReadiness(healthChecks)
      if (ready) return { status: "ready" as const }
      set.status = 503
      return { status: "unavailable" as const }
    },
    { detail: { hide: true } }
  )
