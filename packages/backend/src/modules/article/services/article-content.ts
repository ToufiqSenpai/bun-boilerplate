import type { RichText } from "@bun-boilerplate/richtext"
import { z } from "zod"

export const ARTICLE_UPLOAD_SCHEME = "upload://"

const imageUploadSchema = z.looseObject({
  type: z.literal("image"),
  attrs: z.looseObject({ src: z.string().startsWith(ARTICLE_UPLOAD_SCHEME) })
})

function imageUploadName(node: RichText): string | undefined {
  const parsed = imageUploadSchema.safeParse(node)
  if (!parsed.success) return undefined
  return parsed.data.attrs.src.slice(ARTICLE_UPLOAD_SCHEME.length)
}

export function collectUploadRefs(node: RichText): string[] {
  const refs: string[] = []
  const visit = (current: RichText): void => {
    const name = imageUploadName(current)
    if (name !== undefined && !refs.includes(name)) refs.push(name)
    for (const child of current.content ?? []) visit(child)
  }
  visit(node)
  return refs
}

export function rewriteUploadRefs(node: RichText, keyByPart: ReadonlyMap<string, string>): RichText {
  const name = imageUploadName(node)
  const key = name === undefined ? undefined : keyByPart.get(name)
  const rewritten = key === undefined ? node : { ...node, attrs: { ...node.attrs, src: key } }
  if (!rewritten.content) return rewritten
  return { ...rewritten, content: rewritten.content.map(child => rewriteUploadRefs(child, keyByPart)) }
}
