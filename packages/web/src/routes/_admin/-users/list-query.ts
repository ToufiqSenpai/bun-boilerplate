export const USERS_PAGE_SIZE = 20

export type UsersSortField = "name" | "createdAt"

export interface UsersListState {
  readonly page: number
  readonly q: string
  readonly sortBy: UsersSortField
  readonly desc: boolean
}

export interface ListUsersQuery {
  readonly limit: number
  readonly offset: number
  readonly sortBy: string
  readonly sortDirection: "asc" | "desc"
  readonly searchValue?: string
  readonly searchField?: "email" | "name"
  readonly searchOperator?: "contains"
}

export function pageOffset(page: number): number {
  return (page - 1) * USERS_PAGE_SIZE
}

// better-auth searches one field per request; "@" is a good enough guess for email intent.
// ponytail: add an explicit field toggle if users need name-contains on emails or vice versa.
export function inferSearchField(q: string): "email" | "name" {
  return q.includes("@") ? "email" : "name"
}

export function buildListUsersQuery(state: UsersListState): ListUsersQuery {
  const trimmed = state.q.trim()

  const search =
    trimmed === ""
      ? {}
      : { searchValue: trimmed, searchField: inferSearchField(trimmed), searchOperator: "contains" as const }

  return {
    limit: USERS_PAGE_SIZE,
    offset: pageOffset(state.page),
    sortBy: state.sortBy,
    sortDirection: state.desc ? "desc" : "asc",
    ...search
  }
}
