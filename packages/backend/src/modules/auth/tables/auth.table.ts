import { DEFAULT_LOCALE } from "@bun-boilerplate/i18n"
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { baseColumns } from "../../../common/database.js"

export const users = pgTable("users", {
  ...baseColumns(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  locale: text("locale").notNull().default(DEFAULT_LOCALE),
  image: text("image"),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true })
})

export const sessions = pgTable(
  "sessions",
  {
    ...baseColumns(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by")
  },
  table => [index("sessions_user_id_idx").on(table.userId)]
)

export const accounts = pgTable(
  "accounts",
  {
    ...baseColumns(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    issuer: text("issuer")
  },
  table => [index("accounts_user_id_idx").on(table.userId)]
)

export const verifications = pgTable(
  "verifications",
  {
    ...baseColumns(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  table => [index("verifications_identifier_idx").on(table.identifier)]
)
