import { IconSearch } from "@tabler/icons-react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "src/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "src/components/ui/input-group"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "src/components/ui/pagination"
import { Skeleton } from "src/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { i18n } from "src/i18n"
import {
  buildListUsersQuery,
  USERS_PAGE_SIZE,
  type UsersListState,
  type UsersSortField
} from "src/routes/_admin/-users/list-query"
import {
  toAdminUser,
  toSessionInfo,
  type AdminSessionInfo,
  type AdminUser,
  type QueryStatus,
  type RawSessionRecord,
  type RawUserRecord
} from "src/routes/_admin/-users/map-record"
import { BanBadge, VerificationBadge } from "src/routes/_admin/-users/status-badges"
import { UserDetailDrawer } from "src/routes/_admin/-users/user-drawer"
import { resolveAdminAccess } from "src/routes/admin/-lib/access"
import { authClient } from "src/utils/client"
import { z } from "zod"

const usersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  q: z.string().default("").catch(""),
  sortBy: z.enum(["name", "email", "createdAt"]).default("createdAt").catch("createdAt"),
  desc: z.enum(["true", "false"]).default("true").catch("true")
})

type UsersSearch = z.infer<typeof usersSearchSchema>

function toListState(search: UsersSearch): UsersListState {
  return { page: search.page, q: search.q, sortBy: search.sortBy, desc: search.desc === "true" }
}

function nextSortDesc(
  previous: { sortBy?: UsersSortField; desc?: "true" | "false" },
  field: UsersSortField
): "true" | "false" {
  if (previous.sortBy === field) return previous.desc === "true" ? "false" : "true"
  return field === "createdAt" ? "true" : "false"
}

function sortStateOf(state: UsersListState, field: UsersSortField): "ascending" | "descending" | undefined {
  if (state.sortBy !== field) return undefined
  return state.desc ? "descending" : "ascending"
}

interface AdminClientResult<T> {
  readonly data: T | null
  readonly error: unknown
}

interface UsersListData {
  readonly status: QueryStatus
  readonly users: readonly AdminUser[]
  readonly total: number
}

async function fetchUsers(state: UsersListState): Promise<UsersListData> {
  // SAFETY: the generic better-auth client types omit the admin payload and error shape; only listed fields are read.
  const { data, error } = (await authClient.admin.listUsers({
    query: buildListUsersQuery(state)
  })) as AdminClientResult<{ users: RawUserRecord[]; total: number }>

  if (error || !data) return { status: "error", users: [], total: 0 }

  return { status: "success", users: data.users.map(toAdminUser), total: data.total }
}

interface SessionsData {
  readonly status: QueryStatus
  readonly sessions: readonly AdminSessionInfo[]
}

async function fetchSessions(userId: string): Promise<SessionsData> {
  // SAFETY: the generic better-auth client types omit the admin payload and error shape; sessions are mapped to display fields only, never the token.
  const { data, error } = (await authClient.admin.listUserSessions({
    userId
  })) as AdminClientResult<{ sessions: RawSessionRecord[] }>

  if (error || !data) return { status: "error", sessions: [] }

  return { status: "success", sessions: data.sessions.map(toSessionInfo) }
}

export const Route = createFileRoute("/_admin/admin/users")({
  validateSearch: usersSearchSchema,
  head: () => ({
    meta: [{ title: "Admin Users" }]
  }),
  beforeLoad: ({ context }) => {
    if (!context.adminSetup || !context.adminSession) throw notFound()
    if (resolveAdminAccess(context.adminSetup, context.adminSession, "users") !== "allowed") throw notFound()
  },
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context, deps }) => {
    const state = toListState(deps.search)

    return context.queryClient.ensureQueryData({
      queryKey: ["admin-users", state],
      queryFn: () => fetchUsers(state)
    })
  },
  component: AdminUsersRoute
})

function AdminUsersRoute() {
  return (
    <Suspense fallback={null}>
      <AdminUsersContainer />
    </Suspense>
  )
}

function AdminUsersContainer() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const state = toListState(search)
  const [selected, setSelected] = useState<AdminUser | null>(null)

  const { data } = useSuspenseQuery({
    queryKey: ["admin-users", state],
    queryFn: () => fetchUsers(state)
  })

  return (
    <>
      <UsersPage
        state={state}
        status={data.status}
        users={data.users}
        total={data.total}
        onSearch={query => {
          void navigate({
            to: "/admin/users",
            search: previous => ({ ...previous, q: query, page: 1 })
          })
        }}
        onSort={field => {
          void navigate({
            to: "/admin/users",
            search: previous => ({ ...previous, sortBy: field, desc: nextSortDesc(previous, field), page: 1 })
          })
        }}
        onPage={page => {
          void navigate({ to: "/admin/users", search: previous => ({ ...previous, page }) })
        }}
        onOpen={setSelected}
      />
      {selected && (
        <UserSessionsPanel
          user={selected}
          onClose={() => {
            setSelected(null)
          }}
        />
      )}
    </>
  )
}

function UserSessionsPanel({ user, onClose }: { readonly user: AdminUser; readonly onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["admin-user-sessions", user.id],
    queryFn: () => fetchSessions(user.id)
  })

  return (
    <UserDetailDrawer
      user={user}
      status={data?.status ?? "pending"}
      sessions={data?.sessions ?? []}
      onClose={onClose}
    />
  )
}

export interface UsersPageProps {
  readonly state: UsersListState
  readonly status: QueryStatus
  readonly users: readonly AdminUser[]
  readonly total: number
  readonly onSearch: (query: string) => void
  readonly onSort: (field: UsersSortField) => void
  readonly onPage: (page: number) => void
  readonly onOpen: (user: AdminUser) => void
}

const sortableColumns = [
  { field: "name", label: "admin.users.columns.name" },
  { field: "email", label: "admin.users.columns.email" },
  { field: "createdAt", label: "admin.users.columns.created" }
] as const satisfies readonly { field: UsersSortField; label: string }[]

const hiddenSortableColumns = new Set<UsersSortField>(["email", "createdAt"])

const skeletonRowKeys = [0, 1, 2, 3, 4] as const

function UsersBody({
  status,
  users,
  state,
  onSort,
  onOpen
}: Pick<UsersPageProps, "status" | "users" | "state" | "onSort" | "onOpen">) {
  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
      </Alert>
    )
  }

  if (status === "pending") {
    return (
      <div className="flex flex-col gap-3 py-2">
        {skeletonRowKeys.map(key => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconSearch />
          </EmptyMedia>
          <EmptyTitle>{i18n.t("admin.users.empty.title")}</EmptyTitle>
          <EmptyDescription>{i18n.t("admin.users.empty.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {sortableColumns.map(column => (
            <TableHead
              key={column.field}
              aria-sort={sortStateOf(state, column.field)}
              className={hiddenSortableColumns.has(column.field) ? "hidden md:table-cell" : undefined}
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  onSort(column.field)
                }}
              >
                {i18n.t(column.label)}
              </Button>
            </TableHead>
          ))}
          <TableHead className="hidden md:table-cell">{i18n.t("admin.users.columns.role")}</TableHead>
          <TableHead>{i18n.t("admin.users.columns.verification")}</TableHead>
          <TableHead>{i18n.t("admin.users.columns.ban")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map(user => (
          <TableRow key={user.id}>
            <TableCell>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => {
                  onOpen(user)
                }}
              >
                {user.name}
              </Button>
            </TableCell>
            <TableCell className="hidden md:table-cell">{user.email}</TableCell>
            <TableCell className="hidden md:table-cell">{user.createdAt.slice(0, 10)}</TableCell>
            <TableCell className="hidden md:table-cell">
              <Badge variant="secondary">{user.role ?? "—"}</Badge>
            </TableCell>
            <TableCell>
              <VerificationBadge verified={user.emailVerified} />
            </TableCell>
            <TableCell>
              <BanBadge banned={user.banned} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function UsersPage({ state, status, users, total, onSearch, onSort, onPage, onOpen }: UsersPageProps) {
  const [draft, setDraft] = useState(state.q)
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE))
  const showPagination = status === "success" && users.length > 0 && totalPages > 1

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{i18n.t("admin.users.title")}</h2>
          <p className="text-sm text-muted-foreground">{i18n.t("admin.users.description")}</p>
        </div>
        <form
          className="w-full sm:w-72"
          onSubmit={event => {
            event.preventDefault()
            onSearch(draft)
          }}
        >
          <InputGroup>
            <InputGroupInput
              value={draft}
              placeholder={i18n.t("admin.users.search.placeholder")}
              aria-label={i18n.t("admin.users.search.placeholder")}
              onChange={event => {
                setDraft(event.target.value)
              }}
            />
            <InputGroupAddon align="inline-end">
              <Button size="xs" variant="secondary" type="submit">
                <IconSearch />
                {i18n.t("admin.users.search.submit")}
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>

      <UsersBody status={status} users={users} state={state} onSort={onSort} onOpen={onOpen} />

      {showPagination && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={state.page <= 1}
                onClick={event => {
                  event.preventDefault()
                  if (state.page > 1) onPage(state.page - 1)
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                {state.page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={state.page >= totalPages}
                onClick={event => {
                  event.preventDefault()
                  if (state.page < totalPages) onPage(state.page + 1)
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
