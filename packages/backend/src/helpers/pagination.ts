import { z, ZodType } from "zod"

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("Page number (1-indexed)"),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe("Items per page")
})

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1).describe("Current page number"),
  limit: z.number().int().min(1).describe("Items per page"),
  total: z.number().int().min(0).describe("Total number of items"),
  totalPages: z.number().int().min(0).describe("Total number of pages")
})

export function paginatedSchema<T extends ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema).describe("Paginated items"),
    meta: paginationMetaSchema.describe("Pagination metadata")
  })
}

export type PaginationQueryDto = z.output<typeof paginationQuerySchema>
export type PaginationMetaDto = z.output<typeof paginationMetaSchema>
export type Paginated<T extends ZodType> = z.output<ReturnType<typeof paginatedSchema<T>>>
