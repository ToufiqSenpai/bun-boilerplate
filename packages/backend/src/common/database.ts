import { join } from "path"

import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import type { Logger } from "drizzle-orm/logger"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator"
import { timestamp, uuid } from "drizzle-orm/pg-core"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator"

import { assetsDir } from "./assets.js"
import { config } from "./config.js"
import { logger } from "./logger.js"

class DatabaseLogger implements Logger {
  public logQuery(query: string): void {
    logger.child({ module: "database" }).debug(query)
  }
}

const isTest = config.app.environment === "test"

export const database = isTest
  ? drizzlePglite({ client: new PGlite() })
  : drizzleNeon(config.database.url, {
      logger: new DatabaseLogger()
    })

export type Database = typeof database

const migrationsFolder = join(assetsDir, "migrations")
const migrateFn = isTest ? migratePglite : migrateNeon

try {
  // SAFETY: migrateNeon and migratePglite share identical MigrationConfig signature; database is narrowed by isTest at init
  // Source: https://orm.drizzle.team/docs/migrations#option-4
  // Source: https://orm.drizzle.team/docs/connect-pglite + https://orm.drizzle.team/docs/connect-neon
  await (migrateFn as typeof migrateNeon)(database as never, { migrationsFolder })
  logger.info({ module: "database", migrationsFolder }, "Database migrations applied")
} catch (error) {
  logger.error({ module: "database", error }, "Failed to run database migrations")
  throw error
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
