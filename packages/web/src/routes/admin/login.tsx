import { createFileRoute, redirect } from "@tanstack/react-router"
import { AdminLoginForm } from "src/routes/admin/-components/login-form"
import { api, authClient } from "src/utils/client"

interface SetupStatus {
  readonly needed: boolean
}

interface SetupStatusResult {
  readonly data: SetupStatus | null | undefined
  readonly error: unknown
  readonly status: number
}

export function requireSetupComplete(result: SetupStatusResult): void {
  const { data, error, status } = result

  if (error === null && status === 200 && data?.needed) throw redirect({ to: "/admin/setup" })
}

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Admin Login" }]
  }),
  loader: async () => {
    requireSetupComplete(await api.auth.setup.get())
  },
  component: AdminLoginPage
})

export function AdminLoginPage() {
  return (
    <AdminLoginForm
      onSignIn={async input => {
        const { error } = await authClient.signIn.email(input)
        return { error }
      }}
    />
  )
}
