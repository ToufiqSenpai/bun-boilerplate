import { queryOptions } from "@tanstack/react-query"
import { authClient } from "src/utils/client"
import { z } from "zod"

export const PAGE_SIZE = 20

export const sortBySchema = z.enum(["name", "email", "createdAt"])

export type SortBy = z.output<typeof sortBySchema>

export const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().default(""),
  sortBy: sortBySchema.default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc")
})

export const usersQuery = (state: z.output<typeof searchSchema>) =>
  queryOptions({
    queryKey: ["users", state],
    queryFn: async () => {
      const { data } = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: (state.page - 1) * PAGE_SIZE,
          sortBy: state.sortBy,
          sortDirection: state.order,
          searchValue: state.search,
          searchField: state.search.includes("@") ? "email" : "name",
          searchOperator: "contains"
        }
      })

      return data
    }
  })

export const userQuery = (userId: string) =>
  queryOptions({
    queryKey: ["user", userId],
    queryFn: async () => {
      const { data } = await authClient.admin.getUser({ query: { id: userId } })

      return data
    }
  })

export const sessionsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["user-sessions", userId],
    queryFn: async () => {
      const { data } = await authClient.admin.listUserSessions({ userId })

      if (!data) throw new Error("Failed to load sessions")

      return data.sessions
    }
  })
