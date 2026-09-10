import type { JSONContent } from "@tiptap/core"
import { getSchema, type Extensions } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import StarterKit from "@tiptap/starter-kit"
import { z } from "zod"

export type RichText = JSONContent

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

// Validates that a JSON value is a rich text document accepted by the shared tiptap schema,
// surfacing the ProseMirror reason on rejection.
export const richTextContentSchema = z
  .json()
  .superRefine((doc, ctx) => {
    if (!(doc instanceof Object) || Array.isArray(doc)) {
      ctx.addIssue({ code: "custom", message: "Rich text document must be a JSON object" })
      return
    }
    try {
      richTextSchema.nodeFromJSON(doc).check()
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid rich text document"
      })
    }
  })
  .transform((doc): RichText => {
    // SAFETY: superRefine above only lets documents through after nodeFromJSON and check accepted them
    return doc as RichText
  })
  .describe("Rich text document validated against the shared tiptap schema")
