import { z } from "zod"

export const timestampSchema = z
  .codec(z.union([z.iso.datetime(), z.date()]), z.date(), {
    decode: value => value instanceof Date ? value : new Date(value),
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
