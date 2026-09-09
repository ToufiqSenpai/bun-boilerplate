import type { RichText } from "@bun-boilerplate/richtext"
import { mockDeep } from "vitest-mock-extended"

import { config } from "../common/config.js"
import type { FileSchema } from "../common/schema.js"
import type { Storage } from "../common/storage/storage.js"
import {
  collectStoredKeys,
  diffStoredKeys,
  resolveImageSrc,
  UploadRefMismatchError,
  uploadInlineImages
} from "./richtext.js"

const base = config.s3.publicBaseUrl.replace(/\/$/, "")

describe("resolveImageSrc", () => {
  test("replaces nested storage keys with public URLs", () => {
    const key = "articles/a.png"
    const doc: RichText = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "image", attrs: { src: key, alt: "a" } }] }]
    }

    const result = resolveImageSrc(doc)
    const src = result.content?.[0]?.content?.[0]?.attrs?.src
    expect(src).toBe(`${base}/${key}`)
    const url = new URL(`${base}/${key}`)
    expect(url.origin).toBe(new URL(config.s3.publicBaseUrl).origin)
  })

  test("passes external and upload refs through", () => {
    const external = "https://cdn.example.org/pic.png"
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: external } },
        { type: "image", attrs: { src: "upload://part-1" } }
      ]
    }

    expect(resolveImageSrc(doc)).toEqual(doc)
  })

  test("leaves malformed keys as-is without throwing", () => {
    const doc: RichText = { type: "doc", content: [{ type: "image", attrs: { src: "not-a-key" } }] }

    expect(() => resolveImageSrc(doc)).not.toThrow()
    expect(resolveImageSrc(doc).content?.[0]?.attrs?.src).toBe("not-a-key")
  })

  test("percent-encodes segments and does not mutate the input", () => {
    const doc: RichText = { type: "doc", content: [{ type: "image", attrs: { src: "avatars/a b.png" } }] }
    const snapshot = structuredClone(doc)

    const result = resolveImageSrc(doc)
    expect(result.content?.[0]?.attrs?.src).toBe(`${base}/avatars/a%20b.png`)
    expect(doc).toEqual(snapshot)
  })
})

describe("collectStoredKeys", () => {
  test("collects nested storage keys once, skipping refs, external urls, and malformed keys", () => {
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "image", attrs: { src: "articles/a.png" } }] },
        { type: "image", attrs: { src: "articles/a.png" } },
        { type: "image", attrs: { src: "articles/b.jpg" } },
        { type: "image", attrs: { src: "upload://part-1" } },
        { type: "image", attrs: { src: "https://cdn.example.org/pic.png" } },
        { type: "image", attrs: { src: "not-a-key" } },
        { type: "paragraph", content: [{ type: "text", text: "plain" }] }
      ]
    }
    const snapshot = structuredClone(doc)

    const keys = collectStoredKeys(doc)

    expect(keys.map(key => key.toString()).sort()).toEqual(["articles/a.png", "articles/b.jpg"])
    expect(doc).toEqual(snapshot)
  })
})

describe("diffStoredKeys", () => {
  test("returns keys dropped from the new document, keeping retained and new keys out", () => {
    const oldContent: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "articles/keep.png" } },
        { type: "image", attrs: { src: "articles/drop.jpg" } }
      ]
    }
    const newContent: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "articles/keep.png" } },
        { type: "image", attrs: { src: "articles/fresh.png" } },
        { type: "image", attrs: { src: "https://cdn.example.org/pic.png" } }
      ]
    }

    const orphans = diffStoredKeys(oldContent, newContent)

    expect(orphans.map(key => key.toString())).toEqual(["articles/drop.jpg"])
  })

  test("returns an empty list when nothing was dropped", () => {
    const doc: RichText = { type: "doc", content: [{ type: "image", attrs: { src: "articles/a.png" } }] }

    expect(diffStoredKeys(doc, structuredClone(doc))).toEqual([])
    expect(diffStoredKeys({ type: "doc", content: [] }, doc)).toEqual([])
  })
})

function imagePart(extension: string, mime: string): FileSchema {
  return { file: new File(["binary"], `part.${extension}`, { type: mime }), mime, extension }
}

describe("uploadInlineImages", () => {
  test("uploads each unique ref once and rewrites src to storage keys", async () => {
    const storage = mockDeep<Storage>()
    storage.upload.mockResolvedValue({ key: "articles/a.png" })
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "upload://a" } },
        { type: "paragraph", content: [{ type: "image", attrs: { src: "upload://a" } }] },
        { type: "image", attrs: { src: "upload://b" } },
        { type: "image", attrs: { src: "https://cdn.example.org/pic.png" } }
      ]
    }

    const [keys, content] = await uploadInlineImages({
      richText: doc,
      files: { a: imagePart("png", "image/png"), b: imagePart("jpg", "image/jpeg") },
      storage,
      collection: "articles"
    })

    expect(storage.upload).toHaveBeenCalledTimes(2)
    expect(storage.upload.mock.calls[0]?.[0]?.headers?.contentType).toBe("image/png")
    expect(keys.map(key => key.toString())).toHaveLength(2)
    expect(keys[0]?.toString()).toMatch(/^articles\/.+\.png$/)
    expect(keys[1]?.toString()).toMatch(/^articles\/.+\.jpg$/)
    expect(JSON.stringify(content)).not.toContain("upload://")
    expect(JSON.stringify(content)).toContain("https://cdn.example.org/pic.png")
    const rewritten = content.content ?? []
    expect(rewritten[0]?.attrs?.src).toBe(keys[0]?.toString())
    expect(rewritten[1]?.content?.[0]?.attrs?.src).toBe(keys[0]?.toString())
    expect(rewritten[2]?.attrs?.src).toBe(keys[1]?.toString())
  })

  test("scopes storage keys to the given collection", async () => {
    const storage = mockDeep<Storage>()
    storage.upload.mockResolvedValue({ key: "galleries/a.png" })
    const doc: RichText = { type: "doc", content: [{ type: "image", attrs: { src: "upload://a" } }] }

    const [keys] = await uploadInlineImages({
      richText: doc,
      files: { a: imagePart("png", "image/png") },
      storage,
      collection: "galleries"
    })

    expect(keys[0]?.collection).toBe("galleries")
    expect(keys[0]?.toString()).toMatch(/^galleries\/.+\.png$/)
  })

  test("forwards the abort signal to every upload", async () => {
    const storage = mockDeep<Storage>()
    storage.upload.mockResolvedValue({ key: "articles/a.png" })
    const controller = new AbortController()
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "upload://a" } },
        { type: "image", attrs: { src: "upload://b" } }
      ]
    }

    await uploadInlineImages({
      richText: doc,
      files: { a: imagePart("png", "image/png"), b: imagePart("jpg", "image/jpeg") },
      storage,
      collection: "articles",
      signal: controller.signal
    })

    expect(storage.upload).toHaveBeenCalledTimes(2)
    for (const call of storage.upload.mock.calls) expect(call[0].signal).toBe(controller.signal)
  })

  test("rejects refs without a matching file before uploading anything", async () => {
    const storage = mockDeep<Storage>()
    const doc: RichText = { type: "doc", content: [{ type: "image", attrs: { src: "upload://ghost" } }] }

    const error = await uploadInlineImages({ richText: doc, files: {}, storage, collection: "articles" }).catch(
      (cause: unknown) => cause
    )

    expect(error).toBeInstanceOf(UploadRefMismatchError)
    // SAFETY: previous expect narrows error to UploadRefMismatchError carrying the missing names
    expect((error as UploadRefMismatchError).missing).toEqual(["ghost"])
    expect(storage.upload).not.toHaveBeenCalled()
  })

  test("rejects files without a matching ref before uploading anything", async () => {
    const storage = mockDeep<Storage>()
    const doc: RichText = { type: "doc", content: [] }

    const error = await uploadInlineImages({
      richText: doc,
      files: { stray: imagePart("png", "image/png") },
      storage,
      collection: "articles"
    }).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(UploadRefMismatchError)
    // SAFETY: previous expect narrows error to UploadRefMismatchError carrying the stray names
    expect((error as UploadRefMismatchError).stray).toEqual(["stray"])
    expect(storage.upload).not.toHaveBeenCalled()
  })

  test("starts every upload at once and discards all keys when one fails", async () => {
    const storage = mockDeep<Storage>()
    storage.upload.mockRejectedValueOnce(new Error("S3 down")).mockResolvedValueOnce({ key: "articles/b.png" })
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "upload://a" } },
        { type: "image", attrs: { src: "upload://b" } }
      ]
    }

    await expect(
      uploadInlineImages({
        richText: doc,
        files: { a: imagePart("png", "image/png"), b: imagePart("jpg", "image/jpeg") },
        storage,
        collection: "articles"
      })
    ).rejects.toThrow("S3 down")
    expect(storage.upload).toHaveBeenCalledTimes(2)
    expect(storage.delete).toHaveBeenCalledTimes(1)
    const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
    const uploaded = storage.upload.mock.calls.map(call => call[0].key.toString()).sort(byKey)
    const [deleted] = storage.delete.mock.calls[0] ?? []
    const discarded = (Array.isArray(deleted) ? deleted : []).map(key => key.toString()).sort(byKey)
    expect(discarded).toEqual(uploaded)
  })
})
