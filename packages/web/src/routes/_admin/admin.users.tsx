import { IconSearch } from "@tabler/icons-react"
import { queryOptions, skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import {
  createColumnHelper,
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState
} from "@tanstack/react-table"
import type { UserWithRole } from "better-auth/plugins/admin"
import { useMemo, useState } from "react"
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
import { BanBadge, VerificationBadge } from "src/routes/_admin/-users/status-badges"
import { UserDetailDrawer } from "src/routes/_admin/-users/user-drawer"
import { authClient } from "src/utils/client"
import { z } from "zod"

const PAGE_SIZE = 20

const sortBySchema = z.enum(["name", "email", "createdAt"])

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().default(""),
  sortBy: sortBySchema.default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc")
})

interface UsersTableMeta {
  openUser: (user: UserWithRole) => void
}

// SAFETY: `tableMeta` is a phantom type-only slot in tableFeatures; the value is stripped at runtime.
const usersTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  tableMeta: {} as UsersTableMeta
})

const userColumnHelper = createColumnHelper<typeof usersTableFeatures, UserWithRole>()

const userColumns = userColumnHelper.columns([
  userColumnHelper.accessor("name", {
    header: ({ column }) => (
      <SortHeader label={i18n.t("admin.users.columns.name")} onClick={column.getToggleSortingHandler()} />
    ),
    cell: ({ row, table }) => (
      <Button
        variant="link"
        className="h-auto p-0"
        onClick={() => {
          table.options.meta?.openUser(row.original)
        }}
      >
        {row.original.name}
      </Button>
    )
  }),
  userColumnHelper.accessor("email", {
    header: ({ column }) => (
      <SortHeader label={i18n.t("admin.users.columns.email")} onClick={column.getToggleSortingHandler()} />
    )
  }),
  userColumnHelper.accessor("createdAt", {
    sortDescFirst: true,
    header: ({ column }) => (
      <SortHeader label={i18n.t("admin.users.columns.created")} onClick={column.getToggleSortingHandler()} />
    ),
    cell: ({ getValue }) => new Date(getValue()).toISOString().slice(0, 10)
  }),
  userColumnHelper.accessor("role", {
    enableSorting: false,
    header: () => i18n.t("admin.users.columns.role"),
    cell: ({ getValue }) => <Badge variant="secondary">{getValue() ?? "—"}</Badge>
  }),
  userColumnHelper.display({
    id: "verification",
    header: () => i18n.t("admin.users.columns.verification"),
    cell: ({ row }) => <VerificationBadge verified={row.original.emailVerified} />
  }),
  userColumnHelper.display({
    id: "ban",
    header: () => i18n.t("admin.users.columns.ban"),
    cell: ({ row }) => <BanBadge banned={row.original.banned ?? false} />
  })
])

const usersQuery = (state: z.output<typeof searchSchema>) =>
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

export const Route = createFileRoute("/_admin/admin/users")({
  validateSearch: searchSchema,
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

function SortHeader({ label, onClick }: { label: string; onClick: ((event: unknown) => void) | undefined }) {
  return (
    <Button variant="ghost" size="xs" onClick={onClick}>
      {label}
    </Button>
  )
}

function AdminUserPage() {
  const navigate = useNavigate()
  const state = Route.useSearch()
  const [selected, setSelected] = useState<UserWithRole | null>(null)
  const [draft, setDraft] = useState(state.search)

  const { data } = useSuspenseQuery(usersQuery(state))

  const sessions = useQuery({
    queryKey: ["user-sessions", selected?.id ?? null],
    queryFn: selected
      ? async () => {
          const { data } = await authClient.admin.listUserSessions({ userId: selected.id })

          if (!data) throw new Error("Failed to load sessions")

          return data.sessions
        }
      : skipToken
  })

  const sorting = useMemo<SortingState>(
    () => [{ id: state.sortBy, desc: state.order === "desc" }],
    [state.sortBy, state.order]
  )
  const pagination = useMemo<PaginationState>(() => ({ pageIndex: state.page - 1, pageSize: PAGE_SIZE }), [state.page])

  const table = useTable({
    features: usersTableFeatures,
    columns: userColumns,
    data: data?.users ?? [],
    getRowId: row => row.id,
    meta: { openUser: setSelected },
    state: { sorting, pagination },
    onSortingChange: updater => {
      const [next] = functionalUpdate(updater, sorting)

      if (!next) return

      void navigate({
        to: "/admin/users",
        search: previous => ({
          ...previous,
          sortBy: sortBySchema.parse(next.id),
          order: next.desc ? "desc" : "asc",
          page: 1
        })
      })
    },
    onPaginationChange: updater => {
      const next = functionalUpdate(updater, pagination)

      void navigate({
        to: "/admin/users",
        search: previous => ({ ...previous, page: next.pageIndex + 1 })
      })
    },
    manualSorting: true,
    manualPagination: true,
    rowCount: data?.total ?? 0,
    enableSortingRemoval: false,
    enableMultiSort: false
  })

  const totalPages = Math.max(1, table.getPageCount())
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
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const sorted = header.column.getIsSorted()

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getAllCells().map(cell => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
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
                search: previous => ({ ...previous, search: draft, page: 1 })
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
                  aria-disabled={!table.getCanPreviousPage()}
                  onClick={event => {
                    event.preventDefault()
                    if (table.getCanPreviousPage()) table.previousPage()
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
                  aria-disabled={!table.getCanNextPage()}
                  onClick={event => {
                    event.preventDefault()
                    if (table.getCanNextPage()) table.nextPage()
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
