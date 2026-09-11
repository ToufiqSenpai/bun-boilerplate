import { Alert, AlertDescription } from "src/components/ui/alert"
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import { Separator } from "src/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "src/components/ui/sheet"
import { Skeleton } from "src/components/ui/skeleton"
import { i18n } from "src/i18n"
import type { AdminSessionInfo, AdminUser, QueryStatus } from "src/routes/_admin/-users/map-record"
import { BanBadge, VerificationBadge } from "src/routes/_admin/-users/status-badges"

export interface UserDetailDrawerProps {
  readonly user: AdminUser | null
  readonly status: QueryStatus
  readonly sessions: readonly AdminSessionInfo[]
  readonly onClose: () => void
}

const sessionSkeletonKeys = [0, 1, 2] as const

function SessionsSection({
  status,
  sessions
}: {
  readonly status: QueryStatus
  readonly sessions: readonly AdminSessionInfo[]
}) {
  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
      </Alert>
    )
  }

  if (status === "pending") {
    return (
      <div className="flex flex-col gap-2">
        {sessionSkeletonKeys.map(key => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{i18n.t("admin.users.drawer.sessionsEmpty")}</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map(session => (
        <li key={session.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>{session.userAgent ?? i18n.t("admin.users.drawer.unknownDevice")}</span>
            <span className="text-muted-foreground">{session.ipAddress ?? "—"}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {i18n.t("admin.users.drawer.expires")} {session.expiresAt.slice(0, 10)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function UserDetailDrawer({ user, status, sessions, onClose }: UserDetailDrawerProps) {
  if (!user) return null

  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent showCloseButton={false} className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{user.name}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.role")}</span>
              <Badge variant="secondary">{user.role ?? "—"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.verification")}</span>
              <VerificationBadge verified={user.emailVerified} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.ban")}</span>
              <BanBadge banned={user.banned} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.created")}</span>
              <span>{user.createdAt.slice(0, 10)}</span>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <h3 className="font-heading text-sm font-medium">{i18n.t("admin.users.drawer.sessions")}</h3>
            <SessionsSection status={status} sessions={sessions} />
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              onClose()
            }}
          >
            {i18n.t("admin.users.drawer.close")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
