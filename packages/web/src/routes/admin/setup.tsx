import { createFileRoute, notFound } from "@tanstack/react-router"
import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import type { SetupStatus, SetupStatusResult } from "src/routes/admin/-components/setup-status"
import { api, authClient } from "src/utils/client"

export function requireSetup(result: SetupStatusResult): SetupStatus {
  const { data, error, status } = result

  if (error !== null || status !== 200 || !data?.needed) throw notFound()

  return data
}

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [{ title: "Admin Setup" }]
  }),
  loader: async () => requireSetup(await api.auth.setup.get()),
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
