import { DEFAULT_LOCALE, type Locale } from "@bun-boilerplate/i18n"
import { pgTable, text, unique, uuid } from "drizzle-orm/pg-core"

import { baseColumns } from "../../../common/database.js"

export const articleCategories = pgTable("article_categories", {
  ...baseColumns()
})

export const articleCategoryTranslations = pgTable(
  "article_category_translations",
  {
    ...baseColumns(),
    locale: text("locale").$type<Locale>().notNull().default(DEFAULT_LOCALE),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => articleCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description")
  },
  table => [
    unique("article_category_translations_category_id_locale_key").on(table.categoryId, table.locale),
    unique("article_category_translations_locale_slug_key").on(table.locale, table.slug)
  ]
)
