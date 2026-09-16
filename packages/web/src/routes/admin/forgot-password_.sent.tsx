import { IconLoader2, IconMail, IconMailCheck } from "@tabler/icons-react"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "src/components/ui/card"
import { RateLimitedError, useSendCooldown } from "src/hooks/use-send-cooldown"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"
import { z } from "zod"

const sentSearchSchema = z.object({
  email: z.email()
})

function sendButtonLabel(sending: boolean, cooldown: number, sent: boolean) {
  if (sending) return i18n.t("admin.passwordReset.sent.sending")
  if (cooldown > 0) return i18n.t("admin.passwordReset.sent.sendCooldown", { seconds: cooldown })
  if (sent) return i18n.t("admin.passwordReset.sent.send")
  return i18n.t("admin.passwordReset.sent.sendFirst")
}

export const Route = createFileRoute("/admin/forgot-password_/sent")({
  ssr: false,
  validateSearch: sentSearchSchema,
  head: () => ({
    meta: [{ title: i18n.t("admin.passwordReset.sent.title") }]
  }),
  component: ForgotPasswordSentPage
})

function ForgotPasswordSentPage() {
  const { email } = Route.useSearch()

  const sendReset = useCallback(async () => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/admin/reset-password`
    })
    if (error) throw error.status === 429 ? new RateLimitedError() : error
  }, [email])

  const { cooldown, sending, sent, error, send } = useSendCooldown({
    storageKey: `admin:forgot-password:${email}:cooldown`,
    send: sendReset,
    messages: {
      rateLimited: i18n.t("admin.passwordReset.sent.error.rateLimited"),
      generic: i18n.t("admin.setup.error.server.generic")
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            {sent ? (
              <IconMailCheck className="size-6 text-muted-foreground" aria-hidden="true" />
            ) : (
              <IconMail className="size-6 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {sent ? i18n.t("admin.passwordReset.sent.title") : i18n.t("admin.passwordReset.sent.titleUnsent")}
          </CardTitle>
          <CardDescription className="text-balance [overflow-wrap:anywhere]">
            {sent
              ? i18n.t("admin.passwordReset.sent.description", { email })
              : i18n.t("admin.passwordReset.sent.descriptionUnsent", { email })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            className="w-full"
            aria-live="polite"
            disabled={cooldown > 0 || sending}
            onClick={() => {
              void send()
            }}
          >
            {sending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
            {sendButtonLabel(sending, cooldown, sent)}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
