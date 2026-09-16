import { IconArrowsUpDown, IconChevronDown, IconChevronRight, IconChevronUp } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
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
import { useMemo } from "react"
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "src/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { i18n } from "src/i18n"
import { PAGE_SIZE, sortBySchema, type SortBy } from "src/routes/_admin/-users/queries"
import { BanBadge, VerificationBadge } from "src/routes/_admin/-users/status-badges"
import { formatDate } from "src/utils/date"

const usersTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature
})

const userColumnHelper = createColumnHelper<typeof usersTableFeatures, UserWithRole>()

const userColumns = userColumnHelper.columns([
  userColumnHelper.accessor("name", {
    header: ({ column }) => (
      <SortHeader
        label={i18n.t("admin.users.columns.name")}
        sorted={column.getIsSorted()}
        onClick={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ row }) => (
      <Button
        variant="link"
        className="h-auto p-0"
        nativeButton={false}
        render={<Link to="/admin/users/$userId" params={{ userId: row.original.id }} />}
      >
        {row.original.name}
      </Button>
    )
  }),
  userColumnHelper.accessor("email", {
    header: ({ column }) => (
      <SortHeader
        label={i18n.t("admin.users.columns.email")}
        sorted={column.getIsSorted()}
        onClick={column.getToggleSortingHandler()}
      />
    )
  }),
  userColumnHelper.accessor("createdAt", {
    sortDescFirst: true,
    header: ({ column }) => (
      <SortHeader
        label={i18n.t("admin.users.columns.created")}
        sorted={column.getIsSorted()}
        onClick={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ getValue }) => formatDate(getValue())
  }),
  userColumnHelper.accessor("role", {
    enableSorting: false,
    header: () => i18n.t("admin.users.columns.role"),
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="capitalize">
        {getValue() ?? "—"}
      </Badge>
    )
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
  }),
  userColumnHelper.display({
    id: "open",
    header: () => null,
    cell: () => <IconChevronRight className="text-muted-foreground" aria-hidden="true" />
  })
])

interface SortHeaderProps {
  readonly label: string
  readonly sorted: false | "asc" | "desc"
  readonly onClick: ((event: unknown) => void) | undefined
}

function SortHeader({ label, sorted, onClick }: SortHeaderProps) {
  const Icon = sorted === "asc" ? IconChevronUp : sorted === "desc" ? IconChevronDown : IconArrowsUpDown

  return (
    <Button variant="ghost" size="sm" className="-ml-3" onClick={onClick}>
      {label}
      <Icon className="text-muted-foreground" aria-hidden="true" />
    </Button>
  )
}

interface UsersTableProps {
  readonly users: UserWithRole[]
  readonly total: number
  readonly page: number
  readonly sortBy: SortBy
  readonly order: "asc" | "desc"
  readonly onSortChange: (sortBy: SortBy, order: "asc" | "desc") => void
  readonly onPageChange: (page: number) => void
}

export function UsersTable({ users, total, page, sortBy, order, onSortChange, onPageChange }: UsersTableProps) {
  const sorting = useMemo<SortingState>(() => [{ id: sortBy, desc: order === "desc" }], [sortBy, order])
  const pagination = useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize: PAGE_SIZE }), [page])

  const table = useTable({
    features: usersTableFeatures,
    columns: userColumns,
    data: users,
    getRowId: row => row.id,
    state: { sorting, pagination },
    onSortingChange: updater => {
      const [next] = functionalUpdate(updater, sorting)

      if (!next) return

      onSortChange(sortBySchema.parse(next.id), next.desc ? "desc" : "asc")
    },
    onPaginationChange: updater => {
      const next = functionalUpdate(updater, pagination)

      onPageChange(next.pageIndex + 1)
    },
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    enableSortingRemoval: false,
    enableMultiSort: false
  })

  const totalPages = Math.max(1, table.getPageCount())
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <>
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
        <p className="text-sm text-muted-foreground">
          {i18n.t("admin.users.results.showing", { from: rangeStart, to: rangeEnd, total })}
        </p>
        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto justify-end">
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
                  {page} / {totalPages}
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
    </>
  )
}
