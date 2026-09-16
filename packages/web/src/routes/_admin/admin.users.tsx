import { IconPlus, IconSearch } from "@tabler/icons-react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "src/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "src/components/ui/input-group"
import { i18n } from "src/i18n"
import { searchSchema, usersQuery } from "src/routes/_admin/-users/queries"
import { UsersTable } from "src/routes/_admin/-users/table"
import { authClient } from "src/utils/client"

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

function AdminUserPage() {
  const navigate = useNavigate()
  const state = Route.useSearch()
  const { userSession } = Route.useRouteContext()
  const [draft, setDraft] = useState(state.search)

  const { data } = useSuspenseQuery(usersQuery(state))

  const canCreate = authClient.admin.checkRolePermission({ role: userSession.role, permissions: { user: ["create"] } })
  const total = data?.total ?? 0
  const searching = state.search !== ""

  let body
  if (data === null) {
    body = (
      <Alert variant="destructive" className="m-3">
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
          <EmptyTitle>
            {searching
              ? i18n.t("admin.users.empty.search.title", { search: state.search })
              : i18n.t("admin.users.empty.noUsers.title")}
          </EmptyTitle>
          <EmptyDescription>
            {searching
              ? i18n.t("admin.users.empty.search.description")
              : i18n.t("admin.users.empty.noUsers.description")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {searching ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft("")
                void navigate({
                  to: "/admin/users",
                  search: previous => ({ ...previous, search: "", page: 1 })
                })
              }}
            >
              {i18n.t("admin.users.empty.clearSearch")}
            </Button>
          ) : (
            canCreate && (
              <Button render={<Link to="/admin/users/create" />} nativeButton={false} size="sm">
                <IconPlus />
                {i18n.t("admin.users.actions.create")}
              </Button>
            )
          )}
        </EmptyContent>
      </Empty>
    )
  } else {
    body = (
      <UsersTable
        users={data.users}
        total={total}
        page={state.page}
        sortBy={state.sortBy}
        order={state.order}
        onSortChange={(sortBy, order) => {
          void navigate({
            to: "/admin/users",
            search: previous => ({ ...previous, sortBy, order, page: 1 })
          })
        }}
        onPageChange={page => {
          void navigate({
            to: "/admin/users",
            search: previous => ({ ...previous, page })
          })
        }}
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <form
            className="min-w-0 flex-1 sm:max-w-72"
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
          {canCreate && (
            <Button
              aria-label={i18n.t("admin.users.actions.create")}
              render={<Link to="/admin/users/create" />}
              nativeButton={false}
              className="shrink-0"
            >
              <IconPlus />
              <span className="hidden sm:inline">{i18n.t("admin.users.actions.create")}</span>
            </Button>
          )}
        </div>

        {body}
      </div>
    </div>
  )
}
