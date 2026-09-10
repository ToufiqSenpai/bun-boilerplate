import slugify from "@sindresorhus/slugify"
import { fileTypeFromBlob } from "file-type"
import { z } from "zod"

// Accepts a JSON string (plain clients) or an already-parsed JSON object
// (multipart parsing), since z.json() validates values but never parses strings.
export const jsonStringSchema = z
  .union([
    z.string().transform((raw, ctx) => {
      try {
        return JSON.parse(raw)
      } catch {
        ctx.addIssue({ code: "custom", message: "Value must be a JSON string" })
        return z.NEVER
      }
    }),
    z.record(z.string(), z.unknown())
  ])
  .describe("JSON string parsed into a value, or an already-parsed JSON object")

export const noContentSchema = z.undefined().describe("Empty response body on successful deletion")

export const timestampSchema = z
  .codec(z.union([z.iso.datetime(), z.date()]), z.date(), {
    decode: value => (value instanceof Date ? value : new Date(value)),
    encode: date => date.toISOString()
  })
  .describe("ISO 8601 datetime string or Date instance")

// Enriches an uploaded file with the mime type and extension sniffed from its magic bytes,
// since the client-declared type is not trusted. Reads only the leading bytes of the file.
export const fileSchema = z
  .file({ error: "File is required" })
  .transform(async (file, ctx) => {
    const detected = await fileTypeFromBlob(file.slice(0, 4100))
    if (!detected) {
      ctx.addIssue({ code: "custom", message: "File type could not be detected" })
      return z.NEVER
    }
    return { file, mime: detected.mime, extension: detected.ext }
  })
  .describe("File enriched with magic-byte-sniffed mime type and extension")

export type FileSchema = z.output<typeof fileSchema>

export function isFilePart(value: unknown): value is FileSchema {
  if (!(value instanceof Object) || !("file" in value) || !(value.file instanceof File)) return false
  if (!("mime" in value) || !z.string().min(1).safeParse(value.mime).success) return false
  return "extension" in value && z.string().min(1).safeParse(value.extension).success
}

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

export const slugSchema = z
  .string({ error: "Slug must be a string" })
  .min(1, { error: "Slug must not be empty" })
  .max(255, { error: "Slug must be at most 255 characters" })
  .transform(value => slugify(value))
  .refine(slug => slug.length > 0, { error: "Slug must not be empty" })
  .refine(slug => !z.uuidv7().safeParse(slug).success, { error: `Slug must not look like a uuid` })
  .describe("URL-friendly slug, slugified before stored")
