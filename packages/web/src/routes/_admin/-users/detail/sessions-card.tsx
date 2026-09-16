import { IconLoader2 } from "@tabler/icons-react"
import { useSuspenseQuery } from "@tanstack/react-query"
import Bowser from "bowser"
import { Card, CardContent, CardHeader, CardTitle } from "src/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "src/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { i18n } from "src/i18n"
import { sessionsQuery } from "src/routes/_admin/-users/queries"
import { formatDate } from "src/utils/date"

function describeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null

  const { browser, os } = Bowser.parse(userAgent)
  const labels = [browser.name, os.name].filter(name => name !== undefined)

  return labels.length > 0 ? labels.join(" · ") : null
}

interface SessionsCardProps {
  readonly userId: string
}

export function SessionsCard({ userId }: SessionsCardProps) {
  const { data: sessions } = useSuspenseQuery(sessionsQuery(userId))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.sessions")}</CardTitle>
      </CardHeader>
      <CardContent>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
