import { IconLoader2 } from "@tabler/icons-react"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import Bowser from "bowser"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "src/components/ui/alert-dialog"
import { Button } from "src/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "src/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "src/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { i18n } from "src/i18n"
import { sessionsQuery } from "src/routes/_admin/-users/queries"
import { authClient } from "src/utils/client"
import { formatDate } from "src/utils/date"

function describeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null

  const { browser, os } = Bowser.parse(userAgent)
  const labels = [browser.name, os.name].filter(name => name !== undefined)

  return labels.length > 0 ? labels.join(" · ") : null
}

interface SessionsCardProps {
  readonly userId: string
  readonly canRevoke: boolean
}

export function SessionsCard({ userId, canRevoke }: SessionsCardProps) {
  const queryClient = useQueryClient()
  const { data: sessions } = useSuspenseQuery(sessionsQuery(userId))
  const [revokeTarget, setRevokeTarget] = useState<(typeof sessions)[number] | null>(null)
  const [revokeAllOpen, setRevokeAllOpen] = useState(false)

  const invalidateSessions = async () => {
    await queryClient.invalidateQueries({ queryKey: ["user-sessions", userId] })
  }

  const revokeSession = useMutation({
    mutationFn: async (sessionToken: string) => {
      const { error } = await authClient.admin.revokeUserSession({ sessionToken })

      if (error) throw error
    },
    onSuccess: invalidateSessions,
    onSettled: () => {
      setRevokeTarget(null)
    }
  })

  const revokeAll = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.revokeUserSessions({ userId })

      if (error) throw error
    },
    onSuccess: invalidateSessions,
    onSettled: () => {
      setRevokeAllOpen(false)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.sessions")}</CardTitle>
        {canRevoke && sessions.length > 0 && (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={revokeAll.isPending}
              onClick={() => {
                setRevokeAllOpen(true)
              }}
            >
              {revokeAll.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
              {i18n.t("admin.users.detail.revokeAll")}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(revokeSession.error || revokeAll.error) && (
          <Alert variant="destructive">
            <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
          </Alert>
        )}

        {sessions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconLoader2 />
              </EmptyMedia>
              <EmptyTitle>{i18n.t("admin.users.detail.sessionsEmpty")}</EmptyTitle>
              <EmptyDescription>{i18n.t("admin.users.detail.unknownDevice")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("admin.users.detail.device")}</TableHead>
                <TableHead className="hidden md:table-cell">{i18n.t("admin.users.detail.ip")}</TableHead>
                <TableHead>{i18n.t("admin.users.detail.expires")}</TableHead>
                {canRevoke && <TableHead className="text-right">{i18n.t("admin.users.detail.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map(session => (
                <TableRow key={session.id}>
                  <TableCell className="max-w-64 truncate" title={session.userAgent ?? undefined}>
                    {describeUserAgent(session.userAgent) ?? i18n.t("admin.users.detail.unknownDevice")}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {session.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(session.expiresAt)}</TableCell>
                  {canRevoke && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setRevokeTarget(session)
                        }}
                      >
                        {i18n.t("admin.users.detail.revoke")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <AlertDialog
          open={revokeTarget !== null}
          onOpenChange={nextOpen => {
            if (!nextOpen) setRevokeTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t("admin.users.detail.revokeConfirm.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("admin.users.detail.revokeConfirm.description", {
                  device: revokeTarget
                    ? (describeUserAgent(revokeTarget.userAgent) ?? i18n.t("admin.users.detail.unknownDevice"))
                    : ""
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revokeSession.isPending}>
                {i18n.t("admin.users.detail.confirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={revokeSession.isPending}
                onClick={() => {
                  if (revokeTarget) revokeSession.mutate(revokeTarget.token)
                }}
              >
                {revokeSession.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {i18n.t("admin.users.detail.confirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={revokeAllOpen}
          onOpenChange={nextOpen => {
            if (!nextOpen) setRevokeAllOpen(false)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t("admin.users.detail.revokeAllConfirm.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("admin.users.detail.revokeAllConfirm.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revokeAll.isPending}>
                {i18n.t("admin.users.detail.confirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={revokeAll.isPending}
                onClick={() => {
                  revokeAll.mutate()
                }}
              >
                {revokeAll.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {i18n.t("admin.users.detail.confirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
