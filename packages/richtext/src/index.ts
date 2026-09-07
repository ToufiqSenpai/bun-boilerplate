import { getSchema, type Extensions } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import StarterKit from "@tiptap/starter-kit"

export type { JSONContent as RichText } from "@tiptap/core"

/**
 * The single source of truth for rich text documents. The web editor must build its
 * editor from this array and the backend must validate against `richTextSchema`, so both
 * sides always resolve the identical ProseMirror schema.
 */
export const richTextExtensions: Extensions = [StarterKit, Image, Link]

/**
 * The ProseMirror schema derived from `richTextExtensions`. Validate stored documents with
 * `richTextSchema.nodeFromJSON(doc).check()`, which throws on schema violations.
 */
export const richTextSchema: ReturnType<typeof getSchema> = getSchema(richTextExtensions)
