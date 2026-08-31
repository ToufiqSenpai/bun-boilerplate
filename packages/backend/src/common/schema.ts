import { z } from "zod"

export const timestampSchema = z.codec(z.union([z.iso.datetime(), z.date()]), z.date(), {
  decode: value => (value instanceof Date ? value : new Date(value)),
  encode: date => date.toISOString()
})

export const collectionSchema = z.object({
  id: z.uuidv7().readonly().describe("Unique identifier"),
  createdAt: timestampSchema.readonly().describe("Creation timestamp"),
  updatedAt: timestampSchema.readonly().describe("Last update timestamp")
})
