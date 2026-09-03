import { sql } from "drizzle-orm"
import { Elysia } from "elysia"

import { database } from "./database.js"
import { logger } from "./logger.js"

export const CHECK_TIMEOUT_MS = 1500

export const LIVE_PATH = "/health/live"

export const READY_PATH = "/health/ready"

export type HealthCheck = () => Promise<boolean>

export type HealthChecks = Record<string, HealthCheck>

export async function databaseCheck(): Promise<boolean> {
  await database.execute(sql`SELECT 1`)
  return true
}

export function isHealthRoute(value: string): boolean {
  const path = toPathname(value)
  return path === LIVE_PATH || path === READY_PATH
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

async function runCheck(name: string, check: HealthCheck): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Health check "${name}" timed out after ${CHECK_TIMEOUT_MS}ms`))
      }, CHECK_TIMEOUT_MS)
    })
    const passed = await Promise.race([check(), timeout])
    if (passed) return true
    logger.warn({ check: name }, "Health check failed")
    return false
  } catch (error) {
    logger.warn({ check: name, err: error }, "Health check failed")
    return false
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export function createHealthPlugin(checks: HealthChecks = { database: databaseCheck }) {
  return new Elysia({ name: "health" })
    .get(LIVE_PATH, () => ({ status: "alive" as const }), { detail: { hide: true } })
    .get(
      READY_PATH,
      async ({ set }) => {
        const entries = Object.entries(checks)
        const results = await Promise.all(entries.map(([name, check]) => runCheck(name, check)))
        const allPassed = results.every(passed => passed)
        if (allPassed) return { status: "ready" as const }
        set.status = 503
        return { status: "unavailable" as const }
      },
      { detail: { hide: true } }
    )
}

export const healthPlugin = createHealthPlugin()
