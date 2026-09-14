import { IconSearch } from "@tabler/icons-react"
import { queryOptions, skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { i18n } from "src/i18n"
import {
  buildListUsersQuery,
  USERS_PAGE_SIZE,
  type UsersListState,
  type UsersSortField
} from "src/routes/_admin/-users/list-query"
import { toAdminUser, toSessionInfo, type AdminSessionInfo, type AdminUser } from "src/routes/_admin/-users/map-record"
import { BanBadge, VerificationBadge } from "src/routes/_admin/-users/status-badges"
import { UserDetailDrawer } from "src/routes/_admin/-users/user-drawer"
import { authClient } from "src/utils/client"
import { z } from "zod"

const usersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  q: z.string().default("").catch(""),
  sortBy: z.enum(["name", "email", "createdAt"]).default("createdAt").catch("createdAt"),
  desc: z.boolean().default(true).catch(true)
})

const usersQuery = (state: UsersListState) =>
  queryOptions({
    queryKey: ["admin-users", state],
    queryFn: async () => {
      const { data } = await authClient.admin.listUsers({ query: buildListUsersQuery(state) })

      if (!data) return null

      return { users: data.users.map(toAdminUser), total: data.total }
    }
  })

async function fetchSessions(userId: string): Promise<AdminSessionInfo[]> {
  const { data } = await authClient.admin.listUserSessions({ userId })

  if (!data) throw new Error("Failed to load sessions")

  return data.sessions.map(toSessionInfo)
}

export const Route = createFileRoute("/_admin/admin/users")({
  validateSearch: usersSearchSchema,
  head: () => ({
    meta: [{ title: "Admin Users" }]
  }),
  beforeLoad: ({ context }) => {
    const role = context.userSession.role

    if (!authClient.admin.checkRolePermission({ role, permissions: { user: ["list"] } })) throw notFound()
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.query({ ...usersQuery(deps), staleTime: "static" }),
  component: AdminUserPage
})

const sortableColumns = [
  { field: "name", label: "admin.users.columns.name" },
  { field: "email", label: "admin.users.columns.email" },
  { field: "createdAt", label: "admin.users.columns.created" }
] as const satisfies readonly { field: UsersSortField; label: string }[]

function AdminUserPage() {
  const navigate = useNavigate()
  const state = Route.useSearch()
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [draft, setDraft] = useState(state.q)

  const { data } = useSuspenseQuery(usersQuery(state))

  const sessions = useQuery({
    queryKey: ["admin-user-sessions", selected?.id ?? null],
    queryFn: selected ? () => fetchSessions(selected.id) : skipToken
  })

  const totalPages = data === null ? 1 : Math.max(1, Math.ceil(data.total / USERS_PAGE_SIZE))
  const showPagination = data !== null && data.users.length > 0 && totalPages > 1

  let body
  if (data === null) {
    body = (
      <Alert variant="destructive">
        <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
      </Alert>
    )
  } else if (data.users.length === 0) {
    body = (
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
  } else {
    body = (
      <Table>
        <TableHeader>
          <TableRow>
            {sortableColumns.map(column => (
              <TableHead
                key={column.field}
                aria-sort={state.sortBy === column.field ? (state.desc ? "descending" : "ascending") : undefined}
                className={column.field === "name" ? undefined : "hidden md:table-cell"}
              >
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    void navigate({
                      to: "/admin/users",
                      search: previous => ({
                        ...previous,
                        sortBy: column.field,
                        desc: previous.sortBy === column.field ? !previous.desc : column.field === "createdAt",
                        page: 1
                      })
                    })
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
          {data.users.map(user => (
            <TableRow key={user.id}>
              <TableCell>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => {
                    setSelected(user)
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

  return (
    <>
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
              void navigate({
                to: "/admin/users",
                search: previous => ({ ...previous, q: draft, page: 1 })
              })
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

        {body}

        {showPagination && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={state.page <= 1}
                  onClick={event => {
                    event.preventDefault()
                    if (state.page > 1) {
                      void navigate({ to: "/admin/users", search: previous => ({ ...previous, page: state.page - 1 }) })
                    }
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
                    if (state.page < totalPages) {
                      void navigate({ to: "/admin/users", search: previous => ({ ...previous, page: state.page + 1 }) })
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
      {selected && (
        <UserDetailDrawer
          user={selected}
          status={sessions.status}
          sessions={sessions.data ?? []}
          onClose={() => {
            setSelected(null)
          }}
        />
      )}
    </>
  )
}
