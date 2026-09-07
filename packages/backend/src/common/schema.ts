import { richTextSchema, type RichText } from "@bun-boilerplate/richtext"
import slugify from "@sindresorhus/slugify"
import { z } from "zod"

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
  .describe("Rich text document validated against the shared tiptap schema")

export const timestampSchema = z
  .codec(z.union([z.iso.datetime(), z.date()]), z.date(), {
    decode: value => (value instanceof Date ? value : new Date(value)),
    encode: date => date.toISOString()
  })
  .describe("ISO 8601 datetime string or Date instance")

export const collectionSchema = z
  .object({
    id: z.uuidv7().readonly().describe("Unique identifier"),
    createdAt: timestampSchema.readonly().describe("Creation timestamp"),
    updatedAt: timestampSchema.readonly().describe("Last update timestamp")
  })
  .describe("Base collection item with identifiers and timestamps")

type CollectionShape = typeof collectionSchema.shape

export function omitCollection<Shape extends z.ZodRawShape & CollectionShape>(
  schema: z.ZodObject<Shape>
): z.ZodObject<Omit<Shape, keyof CollectionShape>> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = schema.shape

  return z.object(rest)
}

export function slugSchema(idEntity: string) {
  return z
    .string({ error: "Slug must be a string" })
    .min(1, { error: "Slug must not be empty" })
    .max(255, { error: "Slug must be at most 255 characters" })
    .transform(value => slugify(value))
    .refine(slug => slug.length > 0, { error: "Slug must not be empty" })
    .refine(slug => !z.uuidv7().safeParse(slug).success, { error: `Slug must not look like a ${idEntity} id` })
    .describe("URL-friendly slug, slugified before stored")
}
