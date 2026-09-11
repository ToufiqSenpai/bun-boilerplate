import type { Locale } from "@bun-boilerplate/i18n"
import { and, count, desc, eq } from "drizzle-orm"
import { NotFoundError } from "elysia"
import { z } from "zod"

import type { Database } from "../../../common/database.js"
import { isUniqueViolation } from "../../../common/database.js"
import { ConflictError } from "../../../common/error.js"
import type { Paginated } from "../../../helpers/pagination.js"
import { pageMeta } from "../../../helpers/pagination.js"
import type {
  ArticleCategory,
  ArticleCategoryTranslationParams,
  CreateArticleCategoryBody,
  DeleteArticleCategoryParams,
  ListArticleCategoriesQuery,
  UpsertArticleCategoryTranslationBody
} from "../schemas/article-category.schema.js"
import { articleCategorySchema } from "../schemas/article-category.schema.js"
import { articleCategories, articleCategoryTranslations } from "../tables/article-category.table.js"

export class ArticleCategoryService {
  private readonly articleCategoryProjection = {
    id: articleCategories.id,
    createdAt: articleCategories.createdAt,
    updatedAt: articleCategories.updatedAt,
    locale: articleCategoryTranslations.locale,
    name: articleCategoryTranslations.name,
    slug: articleCategoryTranslations.slug,
    description: articleCategoryTranslations.description
  }

  public constructor(private readonly database: Database) {}

  public async list(
    query: ListArticleCategoriesQuery,
    locale: Locale
  ): Promise<Paginated<typeof articleCategorySchema>> {
    const offset = (query.page - 1) * query.limit

    const [rows, [countResult]] = await Promise.all([
      this.database
        .select(this.articleCategoryProjection)
        .from(articleCategories)
        .innerJoin(articleCategoryTranslations, eq(articleCategories.id, articleCategoryTranslations.categoryId))
        .where(eq(articleCategoryTranslations.locale, locale))
        .orderBy(desc(articleCategories.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database
        .select({ value: count() })
        .from(articleCategories)
        .innerJoin(articleCategoryTranslations, eq(articleCategories.id, articleCategoryTranslations.categoryId))
        .where(eq(articleCategoryTranslations.locale, locale))
    ])

    const total = countResult?.value ?? 0

    return {
      data: rows,
      meta: pageMeta(query, total)
    }
  }

  public async getByIdentifier(identifier: string, locale: Locale): Promise<ArticleCategory> {
    const isId = z.uuidv7().safeParse(identifier).success
    const predicate = isId
      ? and(eq(articleCategories.id, identifier), eq(articleCategoryTranslations.locale, locale))
      : and(eq(articleCategoryTranslations.locale, locale), eq(articleCategoryTranslations.slug, identifier))

    const [row] = await this.database
      .select(this.articleCategoryProjection)
      .from(articleCategories)
      .innerJoin(articleCategoryTranslations, eq(articleCategories.id, articleCategoryTranslations.categoryId))
      .where(predicate)
      .limit(1)
    if (!row) throw new NotFoundError("Article category not found")

    return row
  }

  public async create(data: CreateArticleCategoryBody): Promise<ArticleCategory> {
    try {
      const { category, translation } = await this.database.transaction(async tx => {
        const [category] = await tx.insert(articleCategories).values({}).returning()
        if (!category) throw new Error("Failed to create article category")

        const [translation] = await tx
          .insert(articleCategoryTranslations)
          .values({
            categoryId: category.id,
            locale: data.locale,
            name: data.name,
            slug: data.slug,
            description: data.description
          })
          .returning()
        if (!translation) throw new Error("Failed to create article category translation")

        return { category, translation }
      })

      return { ...translation, ...category }
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Slug already exists")
      throw error
    }
  }

  public async upsertTranslation(
    params: ArticleCategoryTranslationParams,
    data: UpsertArticleCategoryTranslationBody
  ): Promise<{ translation: ArticleCategory; created: boolean }> {
    try {
      return await this.database.transaction(async tx => {
        const [category] = await tx
          .select({
            id: articleCategories.id,
            createdAt: articleCategories.createdAt,
            updatedAt: articleCategories.updatedAt
          })
          .from(articleCategories)
          .where(eq(articleCategories.id, params.id))
          .limit(1)
        if (!category) throw new NotFoundError("Article category not found")

        const [current] = await tx
          .select({ id: articleCategoryTranslations.id })
          .from(articleCategoryTranslations)
          .where(
            and(
              eq(articleCategoryTranslations.categoryId, params.id),
              eq(articleCategoryTranslations.locale, params.locale)
            )
          )
          .limit(1)

        const [translation] = await tx
          .insert(articleCategoryTranslations)
          .values({
            categoryId: params.id,
            locale: params.locale,
            name: data.name,
            slug: data.slug,
            description: data.description
          })
          .onConflictDoUpdate({
            target: [articleCategoryTranslations.categoryId, articleCategoryTranslations.locale],
            set: { name: data.name, slug: data.slug, description: data.description }
          })
          .returning()
        if (!translation) throw new Error("Failed to upsert article category translation")

        return {
          translation: { ...translation, ...category },
          created: !current
        }
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Slug already exists")
      throw error
    }
  }

  public async delete(params: DeleteArticleCategoryParams): Promise<void> {
    const [deleted] = await this.database
      .delete(articleCategories)
      .where(eq(articleCategories.id, params.id))
      .returning()
    if (!deleted) throw new NotFoundError("Article category not found")
  }
}
