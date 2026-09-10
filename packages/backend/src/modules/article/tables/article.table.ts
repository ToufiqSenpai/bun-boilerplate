import { DEFAULT_LOCALE, type Locale } from "@bun-boilerplate/i18n"
import type { RichText } from "@bun-boilerplate/richtext"
import { jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

import { baseColumns } from "../../../common/database.js"
import { users } from "../../auth/tables/auth.table.js"
import { articleCategories } from "./article-category.table.js"

export const articleStatusEnum = pgEnum("article_status", ["draft", "published", "archived"])

export const articles = pgTable("articles", {
  ...baseColumns(),
  status: articleStatusEnum("status").notNull().default("draft"),
  coverKey: text("cover_key").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => articleCategories.id, { onDelete: "set null" })
})

export type ArticleStatus = (typeof articles.$inferSelect)["status"]

export const articleTranslations = pgTable(
  "article_translations",
  {
    ...baseColumns(),
    locale: text("locale").$type<Locale>().notNull().default(DEFAULT_LOCALE),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt").notNull(),
    content: jsonb("content").$type<RichText>().notNull(),
    metaTitle: text("meta_title").notNull(),
    metaDescription: text("meta_description").notNull()
  },
  table => [
    unique("article_translations_article_id_locale_key").on(table.articleId, table.locale),
    unique("article_translations_locale_slug_key").on(table.locale, table.slug)
  ]
)
