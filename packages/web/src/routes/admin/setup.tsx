import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import { VerificationPendingCard } from "src/routes/admin/-components/verification-pending"
import { api, authClient } from "src/utils/client"

export interface SetupStatus {
  readonly needed: boolean
}

export interface SetupStatusResult {
  readonly data: SetupStatus | null | undefined
  readonly error: unknown
  readonly status: number
}

export function requireSetup(result: SetupStatusResult): SetupStatus {
  const { data, error, status } = result

  if (error !== null || status !== 200 || !data?.needed) throw notFound()

  return data
}

export const EMAIL_TAKEN_MESSAGE_PATTERN = /already (taken|exists)/i

export function isEmailTakenError(message: string | undefined | null): boolean {
  return message !== undefined && message !== null && EMAIL_TAKEN_MESSAGE_PATTERN.test(message)
}

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [{ title: "Admin Setup" }]
  }),
  loader: async () => requireSetup(await api.auth.setup.get()),
  component: AdminSetupPage
})

export function AdminSetupPage() {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const navigate = useNavigate()

  if (pendingEmail !== null) {
    return (
      <VerificationPendingCard
        email={pendingEmail}
        onSend={async () => {
          const { error } = await authClient.sendVerificationEmail({ email: pendingEmail })
          return { error }
        }}
        onBackToLogin={() => {
          void navigate({ to: "/admin/login" })
        }}
      />
    )
  }

  return (
    <AdminSetupForm
      onSignUp={async input => {
        const { error } = await authClient.signUp.email(input)

        if (!error || isEmailTakenError(error.message)) {
          setPendingEmail(input.email)
          return { error: null }
        }

        return { error }
      }}
      onSetupComplete={setPendingEmail}
    />
  )
}
