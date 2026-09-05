import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardFooter } from "src/components/ui/card"
import { i18n } from "src/i18n"
import { AdminSetupForm, type SetupSignUpInput, type SetupSignUpResult } from "src/routes/admin/-components/setup-form"
import { VerificationPendingCard, type SendResult } from "src/routes/admin/-components/verification-pending"
import { api, authClient } from "src/utils/client"
import { z } from "zod"

export interface SetupStatus {
  readonly needed: boolean
}

export interface SetupStatusResult {
  readonly data: SetupStatus | null | undefined
  readonly error: unknown
  readonly status: number
}

export type SetupPageState =
  | { readonly status: "form" }
  | { readonly status: "pending"; readonly email: string }
  | { readonly status: "outage" }

export function resolveSetupState(setup: SetupStatusResult, email: string | null | undefined): SetupPageState {
  const { data, error, status } = setup

  if (error === null && status === 200 && data?.needed) return { status: "form" }

  if (error === null && status === 200) {
    const pendingEmail = z.email().safeParse(email ?? "")
    if (pendingEmail.success) return { status: "pending", email: pendingEmail.data }

    throw notFound()
  }

  return { status: "outage" }
}

export const EMAIL_TAKEN_MESSAGE_PATTERN = /already (taken|exists)/i

export function isEmailTakenError(message: string | undefined | null): boolean {
  return message !== undefined && message !== null && EMAIL_TAKEN_MESSAGE_PATTERN.test(message)
}

const setupSearchSchema = z.object({
  email: z.string().optional()
})

export const Route = createFileRoute("/admin/setup")({
  validateSearch: setupSearchSchema,
  head: () => ({
    meta: [{ title: "Admin Setup" }]
  }),
  loader: async ({ location }) => {
    // SAFETY: validateSearch has already normalized location.search through setupSearchSchema, so `email` is either a string or absent.
    const requested = (location.search as { email?: string | undefined }).email
    return resolveSetupState(await api.auth.setup.get(), requested)
  },
  component: AdminSetupRoute
})

function AdminSetupRoute() {
  const state = Route.useLoaderData()
  const navigate = useNavigate()

  const backToLogin = () => {
    void navigate({ to: "/admin/login" })
  }

  return <AdminSetupPage state={state} onBackToLogin={backToLogin} />
}

export interface AdminSetupPageProps {
  readonly state?: SetupPageState | undefined
  readonly onBackToLogin?: () => void
  readonly onSend?: (email: string) => Promise<SendResult>
  readonly onSignUp?: (input: SetupSignUpInput) => Promise<SetupSignUpResult>
  readonly onSetupComplete?: (email: string) => void
}

export function AdminSetupPage({
  state = { status: "form" },
  onBackToLogin,
  onSend,
  onSignUp,
  onSetupComplete
}: AdminSetupPageProps) {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const navigate = useNavigate()
  const backToLogin =
    onBackToLogin ??
    (() => {
      void navigate({ to: "/admin/login" })
    })
  const send = onSend ?? (async (to: string) => authClient.sendVerificationEmail({ email: to }))
  const signUp =
    onSignUp ??
    (async input => {
      const { error } = await authClient.signUp.email(input)

      if (!error || isEmailTakenError(error.message)) return { error: null }

      return { error }
    })
  const complete =
    onSetupComplete ??
    ((address: string) => {
      setPendingEmail(address)
    })

  if (state.status === "outage") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm border shadow-sm">
          <CardContent className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertDescription>{i18n.t("admin.setup.error.server.generic")}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="justify-center">
            <Button type="button" variant="link" onClick={backToLogin}>
              {i18n.t("admin.setup.success.backToLogin")}
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  const email = state.status === "pending" ? state.email : pendingEmail

  if (email !== null) {
    return <VerificationPendingCard email={email} onSend={() => send(email)} onBackToLogin={backToLogin} />
  }

  return <AdminSetupForm onSignUp={signUp} onSetupComplete={complete} />
}
