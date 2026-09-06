import { IconSearch } from "@tabler/icons-react"
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
import { Skeleton } from "src/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { i18n } from "src/i18n"
import { USERS_PAGE_SIZE, type UsersListState, type UsersSortField } from "src/routes/_admin/-users/list-query"

export interface AdminUser {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: string | null
  readonly emailVerified: boolean
  readonly createdAt: string
  readonly banned: boolean
  readonly banReason: string | null
  readonly banExpires: string | null
}

export type UsersListStatus = "pending" | "error" | "success"

export interface UsersPageProps {
  readonly state: UsersListState
  readonly status: UsersListStatus
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

export function VerificationBadge({ verified }: { readonly verified: boolean }) {
  return verified ? (
    <Badge>{i18n.t("admin.users.verification.verified")}</Badge>
  ) : (
    <Badge variant="outline">{i18n.t("admin.users.verification.unverified")}</Badge>
  )
}

export function BanBadge({ banned }: { readonly banned: boolean }) {
  return banned ? (
    <Badge variant="destructive">{i18n.t("admin.users.ban.banned")}</Badge>
  ) : (
    <Badge variant="secondary">{i18n.t("admin.users.ban.active")}</Badge>
  )
}

export function UsersPage({ state, status, users, total, onSearch, onSort, onPage, onOpen }: UsersPageProps) {
  const [draft, setDraft] = useState(state.q)
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE))

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

      {status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
        </Alert>
      ) : status === "pending" ? (
        <div className="flex flex-col gap-3 py-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconSearch />
            </EmptyMedia>
            <EmptyTitle>{i18n.t("admin.users.empty.title")}</EmptyTitle>
            <EmptyDescription>{i18n.t("admin.users.empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {sortableColumns.map((column, index) => (
                <TableHead
                  key={column.field}
                  aria-sort={state.sortBy === column.field ? (state.desc ? "descending" : "ascending") : undefined}
                  className={index === 0 ? undefined : "hidden md:table-cell"}
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
      )}

      {status === "success" && users.length > 0 && totalPages > 1 && (
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
