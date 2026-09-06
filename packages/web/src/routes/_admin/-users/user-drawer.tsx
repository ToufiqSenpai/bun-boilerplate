import { Alert, AlertDescription } from "src/components/ui/alert"
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import { Separator } from "src/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "src/components/ui/sheet"
import { Skeleton } from "src/components/ui/skeleton"
import { i18n } from "src/i18n"
import { BanBadge, VerificationBadge, type AdminUser, type QueryStatus } from "src/routes/_admin/-users/users-page"

export interface AdminSessionInfo {
  readonly id: string
  readonly expiresAt: string
  readonly ipAddress: string | null
  readonly userAgent: string | null
}

export interface UserDetailDrawerProps {
  readonly user: AdminUser | null
  readonly status: QueryStatus
  readonly sessions: readonly AdminSessionInfo[]
  readonly onClose: () => void
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
            {status === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
              </Alert>
            ) : status === "pending" ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{i18n.t("admin.users.drawer.sessionsEmpty")}</p>
            ) : (
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
            )}
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
