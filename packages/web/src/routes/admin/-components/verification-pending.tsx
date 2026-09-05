import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardFooter } from "src/components/ui/card"
import { i18n } from "src/i18n"

const SEND_COOLDOWN_SECONDS = 60

interface SendResult {
  readonly error: { readonly status?: number | undefined; readonly message?: string | undefined } | null
}

interface VerificationPendingCardProps {
  readonly email: string
  readonly onSend: () => Promise<SendResult>
  readonly onBackToLogin: () => void
}

function VerificationPendingCard({ email, onSend, onBackToLogin }: VerificationPendingCardProps) {
  const [cooldown, setCooldown] = useState(SEND_COOLDOWN_SECONDS)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown(current => (current > 0 ? current - 1 : current))
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [])

  const send = async () => {
    setSending(true)
    setError(null)

    const { error: sendError } = await onSend()

    setSending(false)

    if (sendError) {
      // A failed send never starts a fresh cooldown; the control stays immediately retryable.
      setError(
        sendError.status === 429
          ? i18n.t("admin.setup.success.error.rateLimited")
          : i18n.t("admin.setup.error.server.generic")
      )
      return
    }

    setCooldown(SEND_COOLDOWN_SECONDS)
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardContent className="flex flex-col gap-4 text-center">
          <Alert>
            <AlertTitle>{i18n.t("admin.setup.success.title")}</AlertTitle>
            <AlertDescription>{i18n.t("admin.setup.success.description", { email })}</AlertDescription>
          </Alert>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              className="w-full"
              disabled={cooldown > 0 || sending}
              onClick={() => {
                void send()
              }}
            >
              {i18n.t("admin.setup.success.send")}
            </Button>
            {cooldown > 0 && (
              <p className="text-xs text-muted-foreground">
                {i18n.t("admin.setup.success.sendCooldown", { seconds: cooldown })}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Button type="button" variant="link" onClick={onBackToLogin}>
            {i18n.t("admin.setup.success.backToLogin")}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}

export { VerificationPendingCard }
export type { SendResult, VerificationPendingCardProps }
