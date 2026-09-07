import { faker } from "@faker-js/faker"
import type { z } from "zod"

import { ARTICLE_MAX_FILE_BYTES, createArticleSchema } from "./article.schema.js"

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

type Input = z.input<typeof createArticleSchema>

export function pngFile(name: string, size: number): File {
  const body = new Uint8Array(Math.max(size, PNG_MAGIC.length))
  body.set(PNG_MAGIC)
  return new File([body], name, { type: "image/png" })
}

function oversizedCover(): File {
  const file = pngFile("cover.png", 1024)
  // SAFETY: Blob size is virtual metadata; shadowing it avoids materializing 21 MB per test
  Object.defineProperty(file, "size", { value: ARTICLE_MAX_FILE_BYTES + 1 })
  return file
}

function createInput(overrides: Partial<Input> = {}): Input {
  return {
    locale: faker.helpers.arrayElement(["en", "id"] as const),
    title: faker.lorem.words({ min: 2, max: 5 }),
    slug: faker.lorem.slug(),
    excerpt: faker.lorem.sentence(),
    content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    metaTitle: faker.lorem.words({ min: 1, max: 3 }),
    metaDescription: faker.lorem.sentence(),
    cover: pngFile("cover.png", 1024),
    ...overrides
  }
}

function parseIssues(input: Partial<Input>) {
  const result = createArticleSchema.safeParse(input)
  if (result.success) expect.unreachable("expected validation to fail")
  return result.error.issues
}

describe("createArticleSchema", () => {
  test("parses a valid multipart payload, keeping dynamic file parts", () => {
    const inline = pngFile("inline-1", 512)
    const result = createArticleSchema.safeParse(createInput({ "inline-1": inline }))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
    expect(result.data.cover).toBeInstanceOf(File)
    expect(result.data["inline-1"]).toBe(inline)
  })

  test("slugifies the provided slug", async () => {
    const rawSlug = faker.lorem.words({ min: 1, max: 3 }).toUpperCase()
    const result = createArticleSchema.safeParse(createInput({ slug: rawSlug }))

    expect(result.success).toBe(true)
  })

  test("rejects a missing cover", () => {
    const { cover: _ignored, ...withoutCover } = createInput()

    expect(parseIssues(withoutCover)).toEqual([expect.objectContaining({ path: ["cover"] })])
  })

  test("rejects an over-size cover", () => {
    expect(parseIssues(createInput({ cover: oversizedCover() }))).toEqual([
      expect.objectContaining({ path: ["cover"] })
    ])
  })

  test("rejects a request whose total upload size exceeds the cap", () => {
    const bigPart = (name: string): File => {
      const file = pngFile(name, 1024)
      // SAFETY: Blob size is virtual metadata; shadowing it avoids materializing megabytes
      Object.defineProperty(file, "size", { value: 19 * 1024 * 1024 })
      return file
    }
    const input = createInput({
      "part-a": bigPart("part-a"),
      "part-b": bigPart("part-b"),
      "part-c": bigPart("part-c"),
      "part-d": bigPart("part-d"),
      "part-e": bigPart("part-e"),
      "part-f": bigPart("part-f")
    })

    expect(parseIssues(input)).toEqual([
      expect.objectContaining({ message: "Total upload size must be at most 100 MB" })
    ])
  })

  test("rejects content that is not a JSON string", () => {
    expect(parseIssues(createInput({ content: "not json {" }))).toEqual([
      expect.objectContaining({ path: ["content"] })
    ])
  })

  test("accepts a pre-parsed content object as delivered by multipart parsing", () => {
    const result = createArticleSchema.safeParse(
      createInput({ content: { type: "doc", content: [{ type: "paragraph" }] } })
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
  })

  test("rejects content with an invalid rich text envelope", () => {
    expect(parseIssues(createInput({ content: JSON.stringify({ type: "nope" }) }))).toEqual([
      expect.objectContaining({ path: ["content"] })
    ])
  })

  test("rejects an empty slug", () => {
    expect(parseIssues(createInput({ slug: "" }))).toEqual([
      expect.objectContaining({ path: ["slug"], message: "Slug must not be empty" })
    ])
  })

  test("rejects a slug that looks like an article id", () => {
    expect(parseIssues(createInput({ slug: faker.string.uuid({ version: 7 }) }))).toEqual([
      expect.objectContaining({ path: ["slug"], message: "Slug must not look like a article id" })
    ])
  })

  test("rejects a non-uuid category id", () => {
    expect(parseIssues(createInput({ categoryId: "not-an-id" }))).toEqual([
      expect.objectContaining({ path: ["categoryId"] })
    ])
  })
})
