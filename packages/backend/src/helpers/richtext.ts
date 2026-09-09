import { Readable } from "stream"

import type { RichText } from "@bun-boilerplate/richtext"
import { randomUUIDv7 } from "bun"
import { z } from "zod"

import type { FileSchema } from "../common/schema.js"
import { StorageKey } from "../common/storage/storage-key.js"
import type { Storage } from "../common/storage/storage.js"

const UPLOAD_SCHEME = "upload://"

const imageNodeSchema = z.looseObject({
  type: z.literal("image"),
  attrs: z.looseObject({ src: z.string() })
})

const uploadImageSchema = z.looseObject({
  type: z.literal("image"),
  attrs: z.looseObject({ src: z.string().startsWith(UPLOAD_SCHEME) })
})

export class UploadRefMismatchError extends Error {
  public constructor(
    public readonly missing: readonly string[],
    public readonly stray: readonly string[]
  ) {
    const problems: string[] = []
    if (missing.length > 0) problems.push(`Unresolved upload references: ${missing.join(", ")}`)
    if (stray.length > 0) problems.push(`Unreferenced file parts: ${stray.join(", ")}`)
    super(problems.join("; "))
    this.name = "UploadRefMismatchError"
  }
}

export function resolveImageSrc(richText: RichText): RichText {
  const resolved: RichText = richText.content
    ? { ...richText, content: richText.content.map(child => resolveImageSrc(child)) }
    : richText
  const image = imageNodeSchema.safeParse(resolved)
  if (!image.success || URL.canParse(image.data.attrs.src)) return resolved
  try {
    return { ...resolved, attrs: { ...resolved.attrs, src: new StorageKey(image.data.attrs.src).toPublicUrl() } }
  } catch {
    return resolved
  }
}

export interface UploadInlineImagesParams {
  collection: string
  files: Record<string, FileSchema>
  richText: RichText
  signal?: AbortSignal | undefined
  storage: Storage
}

export async function uploadInlineImages(params: UploadInlineImagesParams): Promise<[StorageKey[], RichText]> {
  const { richText, files, storage, collection, signal } = params
  const refs = collectUploadRefs(richText)

  const missing = refs.filter(ref => files[ref] === undefined)
  const stray = Object.keys(files).filter(name => !refs.includes(name))
  if (missing.length > 0 || stray.length > 0) throw new UploadRefMismatchError(missing, stray)

  const entries = refs.map(ref => {
    // SAFETY: refs without a file were rejected as missing above, so the lookup always hits
    const target = files[ref] as FileSchema
    return { ref, target, key: new StorageKey(collection, `${randomUUIDv7()}.${target.extension}`) }
  })
  try {
    await Promise.all(
      entries.map(entry =>
        storage.upload({
          key: entry.key,
          // SAFETY: File.stream() yields a web ReadableStream; fromWeb adapts it to the Node Readable upload expects
          stream: Readable.fromWeb(entry.target.file.stream() as never),
          headers: { contentType: entry.target.mime, contentLength: entry.target.file.size },
          signal
        })
      )
    )
  } catch (error) {
    await storage.delete(entries.map(entry => entry.key))
    throw error
  }

  const keyByRef = new Map<string, StorageKey>()
  for (const entry of entries) keyByRef.set(entry.ref, entry.key)
  return [entries.map(entry => entry.key), rewriteUploadRefs(richText, keyByRef)]
}

function uploadPartName(node: RichText): string | undefined {
  const parsed = uploadImageSchema.safeParse(node)
  if (!parsed.success) return undefined
  return parsed.data.attrs.src.slice(UPLOAD_SCHEME.length)
}

function collectUploadRefs(node: RichText): string[] {
  const refs: string[] = []
  const visit = (current: RichText): void => {
    const ref = uploadPartName(current)
    if (ref !== undefined && !refs.includes(ref)) refs.push(ref)
    for (const child of current.content ?? []) visit(child)
  }
  visit(node)
  return refs
}

function rewriteUploadRefs(node: RichText, keyByRef: ReadonlyMap<string, StorageKey>): RichText {
  const ref = uploadPartName(node)
  const key = ref === undefined ? undefined : keyByRef.get(ref)
  const current = key === undefined ? node : { ...node, attrs: { ...node.attrs, src: key.toString() } }
  if (!current.content) return current
  return { ...current, content: current.content.map(child => rewriteUploadRefs(child, keyByRef)) }
}
