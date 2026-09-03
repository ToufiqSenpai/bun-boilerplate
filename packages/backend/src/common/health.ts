import { sql } from "drizzle-orm"
import { Elysia } from "elysia"

import { database } from "./database.js"
import type { Database } from "./database.js"
import { logger } from "./logger.js"

export const CHECK_TIMEOUT_MS = 1500

export interface HealthCheck {
  readonly name: string
  check(): Promise<boolean>
}

export class DatabaseCheck implements HealthCheck {
  public readonly name = "database"

  public constructor(private readonly db: Database = database) {}

  public async check(): Promise<boolean> {
    await this.db.execute(sql`SELECT 1`)
    return true
  }
}

export const healthChecks: HealthCheck[] = [new DatabaseCheck()]

export function isHealthRoute(value: string): boolean {
  const path = toPathname(value)
  return path === "/health/live" || path === "/health/ready"
}

function toPathname(value: string): string {
  const trimmed = value.trim()
  const spaceIndex = trimmed.lastIndexOf(" ")
  const route = spaceIndex === -1 ? trimmed : trimmed.slice(spaceIndex + 1)
  if (route.startsWith("http://") || route.startsWith("https://")) {
    try {
      return new URL(route).pathname
    } catch {
      return route
    }
  }
  const queryIndex = route.indexOf("?")
  const hashIndex = route.indexOf("#")
  const ends: number[] = []
  if (queryIndex !== -1) ends.push(queryIndex)
  if (hashIndex !== -1) ends.push(hashIndex)
  if (ends.length === 0) return route
  return route.slice(0, Math.min(...ends))
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
