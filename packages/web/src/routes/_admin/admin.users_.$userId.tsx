import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import type { UserWithRole } from "better-auth/plugins/admin"
import { Avatar, AvatarFallback, AvatarImage } from "src/components/ui/avatar"
import { Badge } from "src/components/ui/badge"
import { i18n } from "src/i18n"
import { BanSection } from "src/routes/_admin/-users/detail/ban-section"
import { PasswordSection } from "src/routes/_admin/-users/detail/password-section"
import { ProfileSection } from "src/routes/_admin/-users/detail/profile-section"
import { RemoveSection } from "src/routes/_admin/-users/detail/remove-section"
import { RoleSection } from "src/routes/_admin/-users/detail/role-section"
import { SessionsCard } from "src/routes/_admin/-users/detail/sessions-card"
import { UserNotFound } from "src/routes/_admin/-users/detail/user-not-found"
import { sessionsQuery, userQuery } from "src/routes/_admin/-users/queries"
import { VerificationBadge } from "src/routes/_admin/-users/status-badges"
import { authClient } from "src/utils/client"
import { formatDate } from "src/utils/date"

function initials(user: UserWithRole): string {
  const source = user.name.trim() === "" ? user.email : user.name

  return source
    .split(" ")
    .filter(part => part !== "")
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("")
}

export const Route = createFileRoute("/_admin/admin/users_/$userId")({
  head: () => ({
    meta: [{ title: "Admin User" }]
  }),
  beforeLoad: ({ context }) => {
    const role = context.userSession.role

    if (!authClient.admin.checkRolePermission({ role, permissions: { user: ["get"] } })) throw notFound()
  },
  loader: async ({ context, params }) => {
    const canListSessions = authClient.admin.checkRolePermission({
      role: context.userSession.role,
      permissions: { session: ["list"] }
    })

    const [user] = await Promise.all([
      context.queryClient.query(userQuery(params.userId)),
      canListSessions ? context.queryClient.query(sessionsQuery(params.userId)) : undefined
    ])

    if (!user) throw notFound()

    return user
  },
  notFoundComponent: UserNotFound,
  component: UserDetailPage
})

function UserDetailPage() {
  const { userId } = Route.useParams()
  const { userSession } = Route.useRouteContext()
  const { data: user } = useSuspenseQuery(userQuery(userId))

  const role = userSession.role
  const canUpdate = authClient.admin.checkRolePermission({ role, permissions: { user: ["update"] } })
  const canSetRole = authClient.admin.checkRolePermission({ role, permissions: { user: ["set-role"] } })
  const canSetPassword = authClient.admin.checkRolePermission({ role, permissions: { user: ["set-password"] } })
  const canListSessions = authClient.admin.checkRolePermission({ role, permissions: { session: ["list"] } })
  const canRevokeSessions = authClient.admin.checkRolePermission({ role, permissions: { session: ["revoke"] } })
  const canBan = authClient.admin.checkRolePermission({ role, permissions: { user: ["ban"] } })
  const canDelete = authClient.admin.checkRolePermission({ role, permissions: { user: ["delete"] } })
  const sideSectionsSideBySide = canSetRole && canSetPassword

  if (!user) return null

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback className="text-base font-medium">{initials(user)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg font-medium">{user.name}</span>
            <Badge variant="secondary" className="capitalize">
              {user.role ?? "—"}
            </Badge>
            <VerificationBadge verified={user.emailVerified} />
          </div>
          <span className="truncate text-sm text-muted-foreground">{user.email}</span>
          <span className="text-xs text-muted-foreground">
            {i18n.t("admin.users.columns.created")} · {formatDate(user.createdAt)}
          </span>
        </div>
      </div>

      {canUpdate && <ProfileSection user={user} />}

      {(canSetRole || canSetPassword) && (
        <div className={sideSectionsSideBySide ? "grid gap-4 lg:grid-cols-2" : "flex flex-col gap-4"}>
          {canSetRole && <RoleSection user={user} />}
          {canSetPassword && <PasswordSection user={user} />}
        </div>
      )}

      {canListSessions && <SessionsCard userId={userId} canRevoke={canRevokeSessions} />}

      {canBan && <BanSection user={user} />}

      {canDelete && <RemoveSection user={user} />}
    </div>
  )
}
