import { DEFAULT_LOCALE, type Locale } from "@bun-boilerplate/i18n"
import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { baseColumns } from "../../../common/database.js"
import { users } from "../../auth/tables/auth.table.js"
import { articleCategories } from "./article-category.table.js"

export type ArticleContentValue =
  | string
  | number
  | boolean
  | null
  | ArticleContentValue[]
  | { [key: string]: ArticleContentValue }

export type ArticleContent = Record<string, ArticleContentValue>

export const articleStatusEnum = pgEnum("article_status", ["draft", "published", "archived"])

export const articles = pgTable("articles", {
  ...baseColumns(),
  status: articleStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => articleCategories.id, { onDelete: "restrict" })
})

export const articleTranslations = pgTable("article_translations", {
  ...baseColumns(),
  locale: text("locale").$type<Locale>().notNull().default(DEFAULT_LOCALE),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: jsonb("content").$type<ArticleContent>().notNull(),
  metaTitle: text("meta_title").notNull(),
  metaDescription: text("meta_description").notNull()
})
