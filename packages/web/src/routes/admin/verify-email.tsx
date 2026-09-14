import { IconLoader2, IconMail, IconMailCheck } from "@tabler/icons-react"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "src/components/ui/card"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"
import { z } from "zod"

const SEND_COOLDOWN_SECONDS = 60
const COOLDOWN_STORAGE_KEY = "admin:verify-email:cooldown"
const cooldownExpirySchema = z.coerce.number().int().positive()

const verifySearchSchema = z.object({
  email: z.email()
})

function readCooldownSeconds() {
  try {
    const parsed = cooldownExpirySchema.safeParse(sessionStorage.getItem(COOLDOWN_STORAGE_KEY))

    if (!parsed.success) return 0

    return Math.max(0, Math.ceil((parsed.data - Date.now()) / 1000))
  } catch {
    return 0
  }
}

function writeCooldown() {
  sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(Date.now() + SEND_COOLDOWN_SECONDS * 1000))
}

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
  const [sent, setSent] = useState(() => readCooldownSeconds() > 0)
  const [sending, setSending] = useState(() => readCooldownSeconds() === 0)
  const [cooldown, setCooldown] = useState(readCooldownSeconds)
  const [error, setError] = useState<string | null>(null)
  const autoSendRef = useRef(false)

  const send = useCallback(async () => {
    setSending(true)
    setError(null)

    const { error: sendError } = await authClient.sendVerificationEmail({ email })

    setSending(false)

    if (sendError) {
      setSent(false)
      setError(
        sendError.status === 429
          ? i18n.t("admin.setup.success.error.rateLimited")
          : i18n.t("admin.setup.error.server.generic")
      )
      return
    }

    setSent(true)
    setCooldown(SEND_COOLDOWN_SECONDS)
    writeCooldown()
  }, [email])

  useEffect(() => {
    if (readCooldownSeconds() > 0) return
    if (autoSendRef.current) return

    autoSendRef.current = true
    void send()
  }, [send])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => {
      setCooldown(readCooldownSeconds())
    }, 1000)
    return () => {
      clearTimeout(timer)
    }
  }, [cooldown])

  useEffect(() => {
    const sync = () => {
      setCooldown(readCooldownSeconds())
    }
    document.addEventListener("visibilitychange", sync)
    return () => {
      document.removeEventListener("visibilitychange", sync)
    }
  }, [])

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
