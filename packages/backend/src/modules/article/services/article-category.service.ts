import type { Locale } from "@bun-boilerplate/i18n"
import { and, count, desc, eq } from "drizzle-orm"
import { NotFoundError, ValidationError } from "elysia"
import { z } from "zod"

import type { Database } from "../../../common/database.js"
import type { Paginated } from "../../../helpers/pagination.js"
import type {
  ArticleCategory,
  ArticleCategoryTranslationParams,
  CreateArticleCategoryBody,
  DeleteArticleCategoryParams,
  ListArticleCategoriesQuery,
  UpsertArticleCategoryTranslationBody
} from "../schemas/article-category.schema.js"
import { articleCategorySchema, upsertArticleCategoryTranslationSchema } from "../schemas/article-category.schema.js"
import { articleCategories, articleCategoryTranslations } from "../tables/article-category.table.js"

interface JoinedArticleCategoryRow {
  id: string
  createdAt: Date
  updatedAt: Date
  locale: Locale
  name: string
  slug: string
  description: string | null
}

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
      data: rows.map(row => this.toArticleCategory(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit)
      }
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
    if (!row) {
      if (isId) {
        const [exists] = await this.database
          .select({ id: articleCategories.id })
          .from(articleCategories)
          .where(eq(articleCategories.id, identifier))
          .limit(1)
        if (exists) throw new NotFoundError(`Article category translation not found for locale ${locale}`)
      }
      throw new NotFoundError("Article category not found")
    }

    return this.toArticleCategory(row)
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

      return {
        id: category.id,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        locale: translation.locale,
        name: translation.name,
        slug: translation.slug,
        description: translation.description ?? undefined
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") throw this.slugConflictError(data)
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
            set: { name: data.name, slug: data.slug, description: data.description ?? null }
          })
          .returning()
        if (!translation) throw new Error("Failed to upsert article category translation")

        return {
          translation: {
            id: category.id,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
            locale: translation.locale,
            name: translation.name,
            slug: translation.slug,
            description: translation.description ?? undefined
          },
          created: !current
        }
      })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") throw this.slugConflictError(data)
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

  private toArticleCategory(row: JoinedArticleCategoryRow): ArticleCategory {
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      locale: row.locale,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined
    }
  }

  private slugConflictError(data: UpsertArticleCategoryTranslationBody): ValidationError {
    // SAFETY: StandardSchema-style issue list is accepted by Elysia ValidationError to keep the 422 payload shape
    return new ValidationError("body", upsertArticleCategoryTranslationSchema, data, false, [
      { code: "custom", path: ["slug"], message: "Slug already exists" }
    ] as never)
  }
}
