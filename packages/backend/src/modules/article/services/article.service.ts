import type { Locale } from "@bun-boilerplate/i18n"
import type { RichText } from "@bun-boilerplate/richtext"
import { randomUUIDv7 } from "bun"
import { and, count, desc, eq } from "drizzle-orm"
import { NotFoundError, ValidationError } from "elysia"
import { fileTypeFromBlob } from "file-type"
import { Readable } from "stream"
import { z } from "zod"

import { config } from "../../../common/config.js"
import type { Database } from "../../../common/database.js"
import { storage as defaultStorage, type Storage } from "../../../common/storage/storage.js"
import { StorageKey } from "../../../common/storage/storage-key.js"
import type { Paginated } from "../../../helpers/pagination.js"
import { pageMeta } from "../../../helpers/pagination.js"
import type { Article, CreateArticleBody, ListArticlesQuery } from "../schemas/article.schema.js"
import { articleSchema, createArticleSchema } from "../schemas/article.schema.js"
import { articles, articleTranslations } from "../tables/article.table.js"
import { collectUploadRefs, rewriteUploadRefs } from "./article-content.js"

export type ArticleStorage = Pick<Storage, "upload" | "delete">

const CREATE_BODY_FIELDS = new Set([
  "status",
  "categoryId",
  "locale",
  "title",
  "slug",
  "excerpt",
  "content",
  "metaTitle",
  "metaDescription",
  "cover"
])

export interface JoinedArticleRow extends Omit<Article, "cover"> {
  coverKey: string
}

export class ArticleService {
  private readonly articleProjection = {
    id: articles.id,
    createdAt: articles.createdAt,
    updatedAt: articles.updatedAt,
    status: articles.status,
    publishedAt: articles.publishedAt,
    categoryId: articles.categoryId,
    coverKey: articles.coverKey,
    locale: articleTranslations.locale,
    title: articleTranslations.title,
    slug: articleTranslations.slug,
    excerpt: articleTranslations.excerpt,
    content: articleTranslations.content,
    metaTitle: articleTranslations.metaTitle,
    metaDescription: articleTranslations.metaDescription
  }

  private readonly imageNodeSchema = z.looseObject({
    type: z.literal("image"),
    attrs: z.looseObject({ src: z.string() })
  })

  public constructor(
    private readonly database: Database,
    private readonly storage: ArticleStorage = defaultStorage
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
      data: rows.map(row => this.mapRow(row)),
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
      .where(predicate)
      .limit(1)
    if (!row) throw new NotFoundError("Article not found")

    return this.mapRow(row)
  }

  public async create(body: CreateArticleBody): Promise<Article> {
    const inlineFiles = new Map<string, File>()
    for (const [name, value] of Object.entries(body)) {
      if (!CREATE_BODY_FIELDS.has(name) && value instanceof File) inlineFiles.set(name, value)
    }

    const refs = collectUploadRefs(body.content)
    const missing = refs.filter(name => !inlineFiles.has(name))
    if (missing.length > 0) {
      throw this.createValidationError(body, ["content"], `Unresolved upload references: ${missing.join(", ")}`)
    }
    const stray = [...inlineFiles.keys()].filter(name => !refs.includes(name))
    if (stray.length > 0) {
      const [firstStray = "content"] = stray
      throw this.createValidationError(body, [firstStray], `Unreferenced file parts: ${stray.join(", ")}`)
    }

    const allFiles = new Map<string, File>([["cover", body.cover], ...inlineFiles])
    const sniffed = new Map<string, { extension: string; mime: string }>()
    for (const [name, file] of allFiles) {
      const detected = await fileTypeFromBlob(file.slice(0, 4100))
      if (!detected || !detected.mime.startsWith("image/")) {
        throw this.createValidationError(body, [name], `${name} must be an image file`)
      }
      sniffed.set(name, { extension: detected.ext, mime: detected.mime })
    }

    const articleId = randomUUIDv7()
    // ponytail: StorageKey allows a single "collection/name" level, so the per-article
    // scope lives in the name segment; #52 deletes by this prefix.
    const keyByPart = new Map<string, string>()
    for (const [name, info] of sniffed) {
      keyByPart.set(name, `articles/${articleId}-${randomUUIDv7()}.${info.extension}`)
    }

    const uploaded: string[] = []
    try {
      for (const [name, file] of allFiles) {
        const key = keyByPart.get(name)
        const info = sniffed.get(name)
        if (key === undefined || info === undefined) throw new Error("Failed to resolve upload keys")
        await this.storage.upload({
          key: new StorageKey(key),
          stream: this.toUploadStream(file),
          headers: { contentType: info.mime, contentLength: file.size }
        })
        uploaded.push(key)
      }

      const coverKey = keyByPart.get("cover")
      if (coverKey === undefined) throw new Error("Failed to resolve the cover key")
      const content = rewriteUploadRefs(body.content, keyByPart)

      const created = await this.database.transaction(async tx => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: articleId,
            status: body.status ?? "draft",
            coverKey,
            categoryId: body.categoryId ?? null
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
            content,
            metaTitle: body.metaTitle,
            metaDescription: body.metaDescription
          })
          .returning()
        if (!translation) throw new Error("Failed to create article translation")

        return { article, translation }
      })

      return this.mapRow({
        id: created.article.id,
        createdAt: created.article.createdAt,
        updatedAt: created.article.updatedAt,
        status: created.article.status,
        publishedAt: created.article.publishedAt,
        categoryId: created.article.categoryId,
        coverKey: created.article.coverKey,
        locale: created.translation.locale,
        title: created.translation.title,
        slug: created.translation.slug,
        excerpt: created.translation.excerpt,
        content: created.translation.content,
        metaTitle: created.translation.metaTitle,
        metaDescription: created.translation.metaDescription
      })
    } catch (error) {
      await this.removeUploaded(uploaded)
      if (this.hasDatabaseCode(error, "23505")) throw this.slugConflictError(body)
      if (this.hasDatabaseCode(error, "23503")) {
        throw this.createValidationError(body, ["categoryId"], "Category not found")
      }
      throw error
    }
  }

  private toUploadStream(file: File): Readable {
    async function* chunks(): AsyncGenerator<Uint8Array> {
      const reader = file.stream().getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) return
          yield value
        }
      } finally {
        reader.releaseLock()
      }
    }
    return Readable.from(chunks())
  }

  private async removeUploaded(keys: string[]): Promise<void> {    await Promise.all(
      keys.map(async key => {
        try {
          await this.storage.delete(new StorageKey(key))
        } catch {
          // Compensation is best-effort; the original error below stays authoritative
        }
      })
    )
  }

  private hasDatabaseCode(error: unknown, code: string): boolean {
    let current: unknown = error
    while (current instanceof Error) {
      if ("code" in current && current.code === code) return true
      current = current.cause
    }
    return false
  }

  private createValidationError(body: CreateArticleBody, path: string[], message: string): ValidationError {
    // SAFETY: StandardSchema-style issue list is accepted by Elysia ValidationError to keep the 422 payload shape
    return new ValidationError("body", createArticleSchema, body, false, [
      { code: "custom", path, message }
    ] as never)
  }

  private slugConflictError(body: CreateArticleBody): ValidationError {
    // SAFETY: StandardSchema-style issue list is accepted by Elysia ValidationError to keep the 422 payload shape
    return new ValidationError("body", createArticleSchema, body, false, [
      { code: "custom", path: ["slug"], message: "Slug already exists" }
    ] as never)
  }

  private mapRow(row: JoinedArticleRow): Article {
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      status: row.status,
      publishedAt: row.publishedAt,
      categoryId: row.categoryId,
      locale: row.locale,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      content: this.resolveNode(row.content),
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      cover: this.toPublicUrl(row.coverKey)
    }
  }

  private toPublicUrl(key: string): string | undefined {
    if (!key) return undefined
    // ponytail: any scheme-prefixed src (https://, upload://) passes through; StorageKeys containing ":" in
    // the first segment would read as a scheme too — #49 generates uuid names, revisit if keys ever allow ":"
    if (URL.canParse(key)) return key
    const encoded = key.split("/").map(encodeURIComponent).join("/")
    return new URL(encoded, `${config.s3.publicBaseUrl.replace(/\/$/, "")}/`).href
  }

  private resolveNode(node: RichText): RichText {
    const resolved: RichText = node.content
      ? { ...node, content: node.content.map(child => this.resolveNode(child)) }
      : node
    const image = this.imageNodeSchema.safeParse(node)
    if (!image.success || !resolved.attrs) return resolved

    return {
      ...resolved,
      attrs: { ...resolved.attrs, src: this.toPublicUrl(image.data.attrs.src) ?? image.data.attrs.src }
    }
  }
}
