import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { buildListUsersQuery, type UsersListState } from "src/routes/_admin/-users/list-query"
import {
  toAdminUser,
  toSessionInfo,
  type RawSessionRecord,
  type RawUserRecord
} from "src/routes/_admin/-users/map-record"
import { UserDetailDrawer, type AdminSessionInfo } from "src/routes/_admin/-users/user-drawer"
import { UsersPage, type AdminUser, type QueryStatus } from "src/routes/_admin/-users/users-page"
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

async function fetchSessions(
  userId: string
): Promise<Omit<UsersListData, "users" | "total"> & { sessions: readonly AdminSessionInfo[] }> {
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
            search: previous => ({
              ...previous,
              sortBy: field,
              desc:
                previous.sortBy === field
                  ? previous.desc === "true"
                    ? "false"
                    : "true"
                  : field === "createdAt"
                    ? "true"
                    : "false",
              page: 1
            })
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
