import { createFileRoute, notFound } from "@tanstack/react-router"
import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import { api, authClient } from "src/utils/client"

interface SetupStatus {
  readonly needed: boolean
}

interface SetupStatusResult {
  readonly data: SetupStatus | null | undefined
  readonly error: unknown
  readonly status: number
}

export function requireSetupNeeded(result: SetupStatusResult): SetupStatus {
  const { data, error, status } = result

  if (error !== null || status !== 200 || !data || !data.needed) throw notFound()

  return data
}

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [{ title: "Admin Setup" }]
  }),
  loader: async () => requireSetupNeeded(await api.auth.setup.get()),
  component: AdminSetupPage
})

export function AdminSetupPage() {
  return (
    <AdminSetupForm
      onSignUp={async input => {
        const { error } = await authClient.signUp.email(input)
        return { error }
      }}
    />
  )
}
