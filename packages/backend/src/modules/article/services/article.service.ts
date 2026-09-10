import { Readable } from "stream"

import type { Locale } from "@bun-boilerplate/i18n"
import { randomUUIDv7 } from "bun"
import { and, count, desc, eq } from "drizzle-orm"
import { NotFoundError, ValidationError } from "elysia"
import { z } from "zod"

import type { Database } from "../../../common/database.js"
import { hasPgCode, isUniqueViolation } from "../../../common/database.js"
import { ConflictError } from "../../../common/error.js"
import type { FileSchema } from "../../../common/schema.js"
import { isFilePart } from "../../../common/schema.js"
import { StorageKey } from "../../../common/storage/storage-key.js"
import type { Storage } from "../../../common/storage/storage.js"
import type { Paginated } from "../../../helpers/pagination.js"
import { pageMeta } from "../../../helpers/pagination.js"
import {
  UploadRefMismatchError,
  deleteStoredKeys,
  resolveImageSrc,
  uploadInlineImages
} from "../../../helpers/richtext.js"
import type {
  Article,
  ArticleTranslationParams,
  CreateArticleBody,
  DeleteArticleParams,
  ListArticlesQuery,
  UpdateArticleBody,
  UpdateArticleParams,
  UpdatedArticle,
  UpsertArticleTranslationBody
} from "../schemas/article.schema.js"
import { articleSchema, createArticleSchema, upsertArticleTranslationSchema } from "../schemas/article.schema.js"
import { users } from "../../auth/tables/auth.table.js"
import { articles, articleTranslations } from "../tables/article.table.js"

interface AuthorFields {
  authorId: string | null
  authorName: string | null
  authorImage: string | null
}

export interface JoinedArticleRow extends Omit<Article, "cover" | "author">, AuthorFields {
  coverKey: string
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

export class ArticleService {
  private readonly articleCollection = "articles"

  private readonly articleProjection = {
    id: articles.id,
    createdAt: articles.createdAt,
    updatedAt: articles.updatedAt,
    status: articles.status,
    publishedAt: articles.publishedAt,
    categoryId: articles.categoryId,
    coverKey: articles.coverKey,
    authorId: articles.authorId,
    authorName: users.name,
    authorImage: users.image,
    locale: articleTranslations.locale,
    title: articleTranslations.title,
    slug: articleTranslations.slug,
    excerpt: articleTranslations.excerpt,
    content: articleTranslations.content,
    metaTitle: articleTranslations.metaTitle,
    metaDescription: articleTranslations.metaDescription
  }

  public constructor(
    private readonly database: Database,
    private readonly storage: Storage
  ) {}

  public async list(
    query: ListArticlesQuery,
    locale: Locale,
    canViewUnpublished = false
  ): Promise<Paginated<typeof articleSchema>> {
    const offset = (query.page - 1) * query.limit

    const status = canViewUnpublished ? query.status : "published"
    const wherePredicate = and(eq(articleTranslations.locale, locale), eq(articles.status, status))

    const [rows, [countResult]] = await Promise.all([
      this.database
        .select(this.articleProjection)
        .from(articles)
        .innerJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .leftJoin(users, eq(articles.authorId, users.id))
        .where(wherePredicate)
        .orderBy(desc(articles.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database
        .select({ value: count() })
        .from(articles)
        .innerJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(wherePredicate)
    ])

    const total = countResult?.value ?? 0

    return {
      data: rows.map(row => this.mapTranslation(row)),
      meta: pageMeta(query, total)
    }
  }

  public async getByIdentifier(identifier: string, locale: Locale, canViewUnpublished = false): Promise<Article> {
    const isId = z.uuidv7().safeParse(identifier).success
    const predicate = and(
      canViewUnpublished ? undefined : eq(articles.status, "published"),
      eq(articleTranslations.locale, locale),
      isId ? eq(articles.id, identifier) : eq(articleTranslations.slug, identifier)
    )

    const [row] = await this.database
      .select(this.articleProjection)
      .from(articles)
      .innerJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
      .leftJoin(users, eq(articles.authorId, users.id))
      .where(predicate)
      .limit(1)
    if (!row) throw new NotFoundError("Article not found")

    return this.mapTranslation(row)
  }

  public async create(body: CreateArticleBody, signal?: AbortSignal): Promise<Article> {
    const { content, cover, ...rest } = body
    const inlineFiles: Record<string, FileSchema> = {}
    for (const [name, value] of Object.entries(rest)) {
      if (isFilePart(value)) inlineFiles[name] = value
    }
    const uploaded: StorageKey[] = []
    try {
      const [inlineKeys, resolvedContent] = await uploadInlineImages({
        richText: content,
        files: inlineFiles,
        storage: this.storage,
        collection: this.articleCollection,
        signal
      })
      uploaded.push(...inlineKeys)

      const coverKey = await this.uploadCover(cover, signal)
      uploaded.push(coverKey)

      const articleId = randomUUIDv7()
      const created = await this.database.transaction(async tx => {
        const author = await this.loadAuthor(tx, body.authorId)
        if (!author) throw new NotFoundError("Author not found")

        const [article] = await tx
          .insert(articles)
          .values({
            id: articleId,
            status: body.status,
            coverKey: coverKey.toString(),
            categoryId: body.categoryId ?? null,
            authorId: body.authorId
          })
          .returning()
        if (!article) throw new Error("Failed to create article")

        const [translation] = await tx
          .insert(articleTranslations)
          .values({
            articleId,
            locale: body.locale,
            title: body.title,
            slug: body.slug,
            excerpt: body.excerpt,
            content: resolvedContent,
            metaTitle: body.metaTitle,
            metaDescription: body.metaDescription
          })
          .returning()
        if (!translation) throw new Error("Failed to create article translation")

        return { article, translation, author }
      })

      return this.mapTranslation({ ...created.translation, ...created.article, ...created.author })
    } catch (error) {
      await this.storage.delete(uploaded)
      if (error instanceof UploadRefMismatchError) throw this.uploadMismatchError(body, error)
      if (isUniqueViolation(error)) throw new ConflictError("Slug already exists")
      if (hasPgCode(error, "23503")) throw new NotFoundError("Category not found")
      throw error
    }
  }

  public async upsertTranslation(
    params: ArticleTranslationParams,
    body: UpsertArticleTranslationBody,
    signal?: AbortSignal
  ): Promise<{ translation: Article; created: boolean }> {
    const { content, ...rest } = body
    const inlineFiles: Record<string, FileSchema> = {}
    for (const [name, value] of Object.entries(rest)) {
      if (isFilePart(value)) inlineFiles[name] = value
    }
    const uploaded: StorageKey[] = []
    try {
      const [inlineKeys, resolvedContent] = await uploadInlineImages({
        richText: content,
        files: inlineFiles,
        storage: this.storage,
        collection: this.articleCollection,
        signal
      })
      uploaded.push(...inlineKeys)

      const upserted = await this.database.transaction(async tx => {
        const [article] = await tx.select().from(articles).where(eq(articles.id, params.id)).limit(1)
        if (!article) throw new NotFoundError("Article not found")

        const [old] = await tx
          .select({ content: articleTranslations.content })
          .from(articleTranslations)
          .where(and(eq(articleTranslations.articleId, params.id), eq(articleTranslations.locale, params.locale)))
          .limit(1)

        const author = article.authorId ? await this.loadAuthor(tx, article.authorId) : undefined

        const translationValues = {
          title: body.title,
          slug: body.slug,
          excerpt: body.excerpt,
          content: resolvedContent,
          metaTitle: body.metaTitle,
          metaDescription: body.metaDescription
        }
        const [translation] = await tx
          .insert(articleTranslations)
          .values({ articleId: params.id, locale: params.locale, ...translationValues })
          .onConflictDoUpdate({
            target: [articleTranslations.articleId, articleTranslations.locale],
            set: translationValues
          })
          .returning()
        if (!translation) throw new Error("Failed to upsert article translation")

        return { article, translation, oldContent: old?.content ?? null, created: !old, author }
      })

      if (upserted.oldContent) await deleteStoredKeys(upserted.oldContent, this.storage)

      return {
        translation: this.mapTranslation({
          ...upserted.translation,
          ...upserted.article,
          authorName: upserted.author?.authorName ?? null,
          authorImage: upserted.author?.authorImage ?? null
        }),
        created: upserted.created
      }
    } catch (error) {
      await this.storage.delete(uploaded)
      if (error instanceof UploadRefMismatchError)
        throw this.uploadMismatchError(body, error, upsertArticleTranslationSchema)
      if (isUniqueViolation(error)) throw new ConflictError("Slug already exists")
      throw error
    }
  }

  public async updateArticle(
    params: UpdateArticleParams,
    body: UpdateArticleBody,
    signal?: AbortSignal
  ): Promise<UpdatedArticle> {
    let newCoverKey: StorageKey | undefined
    try {
      if (body.cover) newCoverKey = await this.uploadCover(body.cover, signal)

      const { row, author, previousCoverKey } = await this.database.transaction(async tx => {
        const [article] = await tx.select().from(articles).where(eq(articles.id, params.id)).limit(1)
        if (!article) throw new NotFoundError("Article not found")

        const targetAuthorId = body.authorId !== undefined ? body.authorId : article.authorId
        const author = targetAuthorId ? await this.loadAuthor(tx, targetAuthorId) : undefined
        if (body.authorId !== undefined && !author) throw new NotFoundError("Author not found")

        const changes: Partial<typeof articles.$inferInsert> = {}
        if (body.status !== undefined) {
          changes.status = body.status
          if (body.status === "published" && article.publishedAt === null) changes.publishedAt = new Date()
        }
        if (body.categoryId !== undefined) changes.categoryId = body.categoryId
        if (body.authorId !== undefined) changes.authorId = body.authorId
        if (newCoverKey) changes.coverKey = newCoverKey.toString()
        if (Object.keys(changes).length === 0) return { row: article, author, previousCoverKey: null }

        const [updated] = await tx.update(articles).set(changes).where(eq(articles.id, params.id)).returning()
        if (!updated) throw new Error("Failed to update article")
        return { row: updated, author, previousCoverKey: newCoverKey ? article.coverKey : null }
      })

      if (previousCoverKey !== null) await this.storage.delete(new StorageKey(previousCoverKey))

      return this.mapArticle(row, this.mapAuthor(author))
    } catch (error) {
      if (newCoverKey) await this.storage.delete(newCoverKey)
      if (hasPgCode(error, "23503")) throw new NotFoundError("Category not found")
      throw error
    }
  }

  public async delete(params: DeleteArticleParams): Promise<void> {
    const { coverKey, contents } = await this.database.transaction(async tx => {
      // Locks the article row before reading translations so a concurrent translation upsert
      // either lands in the snapshot below or fails against the cascade instead of leaking keys
      const [article] = await tx
        .select({ coverKey: articles.coverKey })
        .from(articles)
        .where(eq(articles.id, params.id))
        .limit(1)
        .for("update")
      if (!article) throw new NotFoundError("Article not found")

      const translations = await tx
        .select({ content: articleTranslations.content })
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, params.id))

      await tx.delete(articles).where(eq(articles.id, params.id))

      return { coverKey: article.coverKey, contents: translations.map(translation => translation.content) }
    })

    if (coverKey) await this.storage.delete(new StorageKey(coverKey))
    await Promise.all(contents.map(content => deleteStoredKeys(content, this.storage)))
  }

  private uploadMismatchError(
    body: CreateArticleBody | UpsertArticleTranslationBody,
    error: UploadRefMismatchError,
    schema: typeof createArticleSchema | typeof upsertArticleTranslationSchema = createArticleSchema
  ): ValidationError {
    if (error.missing.length > 0) {
      return this.createValidationError(
        body,
        schema,
        ["content"],
        `Unresolved upload references: ${error.missing.join(", ")}`
      )
    }
    const [firstStray = "content"] = error.stray
    return this.createValidationError(body, schema, [firstStray], `Unreferenced file parts: ${error.stray.join(", ")}`)
  }

  private createValidationError(
    body: CreateArticleBody | UpsertArticleTranslationBody,
    schema: typeof createArticleSchema | typeof upsertArticleTranslationSchema,
    path: string[],
    message: string
  ): ValidationError {
    // SAFETY: StandardSchema-style issue list is accepted by Elysia ValidationError to keep the 422 payload shape
    return new ValidationError("body", schema, body, false, [{ code: "custom", path, message }] as never)
  }

  private async uploadCover(cover: FileSchema, signal?: AbortSignal): Promise<StorageKey> {
    const key = new StorageKey(this.articleCollection, `${randomUUIDv7()}.${cover.extension}`)
    await this.storage.upload({
      key,
      // SAFETY: File.stream() yields a web ReadableStream; fromWeb adapts it to the Node Readable upload expects
      stream: Readable.fromWeb(cover.file.stream() as never),
      headers: { contentType: cover.mime, contentLength: cover.file.size },
      signal
    })
    return key
  }

  private async loadAuthor(tx: Transaction, authorId: string): Promise<AuthorFields | undefined> {
    const [author] = await tx
      .select({ authorId: users.id, authorName: users.name, authorImage: users.image })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1)

    return author
  }

  private mapAuthor(row: AuthorFields | undefined): Article["author"] {
    if (!row?.authorId || !row.authorName) return null
    return { id: row.authorId, name: row.authorName, image: row.authorImage || null }
  }

  private mapArticle(
    row: Omit<typeof articles.$inferSelect, "authorId">,
    author: Article["author"]
  ): UpdatedArticle {
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      status: row.status,
      publishedAt: row.publishedAt,
      categoryId: row.categoryId,
      cover: new StorageKey(row.coverKey).toPublicUrl(),
      author
    }
  }

  private mapTranslation(row: JoinedArticleRow): Article {
    return {
      ...this.mapArticle(row, this.mapAuthor(row)),
      locale: row.locale,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      content: resolveImageSrc(row.content),
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription
    }
  }
}
