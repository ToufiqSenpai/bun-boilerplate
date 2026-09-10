import { join } from "path"

import { sql } from "drizzle-orm"
import type { Logger } from "drizzle-orm/logger"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless"
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator"
import { timestamp, uuid } from "drizzle-orm/pg-core"

import { assetsDir } from "./assets.js"
import { config } from "./config.js"
import { logger } from "./logger.js"

class DatabaseLogger implements Logger {
  public logQuery(query: string): void {
    logger.child({ module: "database" }).debug(query)
  }
}

const isTest = config.app.environment === "test"

export const database = drizzleNeon(config.database.url, {
  logger: new DatabaseLogger()
})

export type Database = typeof database

// Postgres reports integrity violations as SQLSTATE codes on the driver error
// (NeonDbError), wrapped by Drizzle in a DrizzleQueryError cause chain — so match
// the duck-typed code, not the class.
export function hasPgCode(error: unknown, code: string): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if ("code" in current && current.code === code) return true
    current = current.cause
  }
  return false
}

export const isUniqueViolation = (error: unknown): boolean => hasPgCode(error, "23505")

if (!isTest) {
  const migrationsFolder = join(assetsDir, "migrations")

  try {
    // Source: https://orm.drizzle.team/docs/migrations#option-4
    // Source: https://orm.drizzle.team/docs/connect-neon
    await migrateNeon(database, { migrationsFolder })
    logger.info({ module: "database", migrationsFolder }, "Database migrations applied")
  } catch (error) {
    logger.error({ module: "database", error }, "Failed to run database migrations")
    throw error
  }
}

export const baseColumns = () => ({
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
})
