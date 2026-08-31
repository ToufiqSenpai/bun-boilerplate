import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"

import { database } from "../../../common/database.js"
import { articleCategories } from "./article-category.table.js"
import { articles } from "./article.table.js"

async function seedCategory() {
  const [category] = await database.insert(articleCategories).values({}).returning()
  if (!category) throw new Error("failed to seed article category")
  return category
}

async function seedArticle(categoryId: string | null) {
  const [article] = await database.insert(articles).values({ categoryId }).returning()
  if (!article) throw new Error("failed to seed article")
  return article
}

async function readArticle(id: string) {
  const [article] = await database
    .select({ categoryId: articles.categoryId })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1)
  if (!article) throw new Error("article not found")
  return article
}

describe("articles.category_id schema", () => {
  test("persists an article with a category and reads the identifier back", async () => {
    const category = await seedCategory()
    const article = await seedArticle(category.id)

    const stored = await readArticle(article.id)

    expect(stored.categoryId).toBe(category.id)
  })

  test("persists an article without a category and reads null back", async () => {
    const article = await seedArticle(null)

    const stored = await readArticle(article.id)

    expect(stored.categoryId).toBeNull()
  })

  test("rejects an article referencing a category that does not exist", async () => {
    const error = await seedArticle(faker.string.uuid({ version: 7 })).catch((error: unknown) => error)
    // SAFETY: PGlite reports FK violations with code 23503 on the cause; the insert must be rejected
    expect((error as { cause?: { code?: string } }).cause?.code).toBe("23503")
  })

  test("nulls the reference on articles when their category is deleted", async () => {
    const category = await seedCategory()
    const withCategory = await seedArticle(category.id)
    const withoutCategory = await seedArticle(null)

    await database.delete(articleCategories).where(eq(articleCategories.id, category.id))

    expect((await readArticle(withCategory.id)).categoryId).toBeNull()
    expect((await readArticle(withoutCategory.id)).categoryId).toBeNull()
  })

  test("keeps other columns intact when the category reference is nulled on delete", async () => {
    const category = await seedCategory()
    const article = await seedArticle(category.id)

    await database.delete(articleCategories).where(eq(articleCategories.id, category.id))

    const [stored] = await database.select().from(articles).where(eq(articles.id, article.id)).limit(1)
    if (!stored) throw new Error("article not found")
    expect(stored.id).toBe(article.id)
    expect(stored.status).toBe("draft")
  })
})
