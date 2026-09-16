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

const COOLDOWN_STORAGE_KEY = "admin:verify-email:cooldown"

const verifySearchSchema = z.object({
  email: z.email()
})

function sendButtonLabel(sending: boolean, cooldown: number, sent: boolean) {
  if (sending) return i18n.t("admin.setup.success.sending")
  if (cooldown > 0) return i18n.t("admin.setup.success.sendCooldown", { seconds: cooldown })
  if (sent) return i18n.t("admin.setup.success.send")
  return i18n.t("admin.setup.success.sendFirst")
}

export const Route = createFileRoute("/admin/verify-email")({
  ssr: false,
  validateSearch: verifySearchSchema,
  head: () => ({
    meta: [{ title: i18n.t("admin.setup.success.title") }]
  }),
  component: VerifyEmailPage
})

function VerifyEmailPage() {
  const { email } = Route.useSearch()

  const sendEmail = useCallback(async () => {
    const { error: sendError } = await authClient.sendVerificationEmail({ email })
    if (sendError) throw sendError.status === 429 ? new RateLimitedError() : sendError
  }, [email])

  const { cooldown, sending, sent, error, send } = useSendCooldown({
    storageKey: COOLDOWN_STORAGE_KEY,
    send: sendEmail,
    messages: {
      rateLimited: i18n.t("admin.setup.success.error.rateLimited"),
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
            {sent ? i18n.t("admin.setup.success.title") : i18n.t("admin.setup.success.titleUnsent")}
          </CardTitle>
          <CardDescription className="text-balance [overflow-wrap:anywhere]">
            {sent
              ? i18n.t("admin.setup.success.description", { email })
              : i18n.t("admin.setup.success.descriptionUnsent", { email })}
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
