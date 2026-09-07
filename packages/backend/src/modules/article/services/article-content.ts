import type { RichText } from "@bun-boilerplate/richtext"

export const ARTICLE_UPLOAD_SCHEME = "upload://"

function imageUploadName(node: RichText): string | undefined {
  if (node.type !== "image") return undefined
  const src = node.attrs?.src
  if (typeof src !== "string" || !src.startsWith(ARTICLE_UPLOAD_SCHEME)) return undefined
  return src.slice(ARTICLE_UPLOAD_SCHEME.length)
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
