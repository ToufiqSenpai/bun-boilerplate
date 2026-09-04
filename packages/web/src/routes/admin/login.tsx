import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { FieldGroup } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { PasswordInput } from "src/components/ui/password-input"
import { i18n } from "src/i18n"
import { FieldChrome, fieldValidator } from "src/routes/admin/-components/field-chrome"
import type { SetupStatusResult } from "src/routes/admin/-components/setup-status"
import { api, authClient } from "src/utils/client"
import { z } from "zod"

interface SignInInput {
  readonly email: string
  readonly password: string
}

interface SignInResult {
  readonly error: { readonly message?: string | undefined } | null
}

interface AdminLoginFormProps {
  readonly onSignIn: (input: SignInInput) => Promise<SignInResult>
}

const loginSchema = z.object({
  email: z.email(i18n.t("admin.login.error.email.invalid")),
  password: z.string().min(1, i18n.t("admin.login.error.password.required"))
})

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

export function AdminLoginForm({ onSignIn }: AdminLoginFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
    onSubmit: async ({ value }) => {
      setServerError(null)

      const parsed = loginSchema.safeParse(value)

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]
        setServerError(firstIssue?.message ?? i18n.t("admin.login.error.invalidCredentials"))
        return
      }

      const { error } = await onSignIn({ email: parsed.data.email, password: parsed.data.password })

      if (error) {
        setServerError(i18n.t("admin.login.error.invalidCredentials"))
      }
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">{i18n.t("admin.login.title")}</CardTitle>
          <CardDescription className="text-balance">{i18n.t("admin.login.description")}</CardDescription>
        </CardHeader>
        <form
          onSubmit={e => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <CardContent>
            <FieldGroup>
              <form.Field name="email" validators={{ onChange: fieldValidator(loginSchema.shape.email) }}>
                {field => (
                  <FieldChrome
                    id={field.name}
                    label={i18n.t("admin.login.email.label")}
                    touched={field.state.meta.isTouched}
                    messages={field.state.meta.errors.map(String)}
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      autoComplete="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                  </FieldChrome>
                )}
              </form.Field>

              <form.Field name="password" validators={{ onChange: fieldValidator(loginSchema.shape.password) }}>
                {field => (
                  <FieldChrome
                    id={field.name}
                    label={i18n.t("admin.login.password.label")}
                    touched={field.state.meta.isTouched}
                    messages={field.state.meta.errors.map(String)}
                  >
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="current-password"
                      showPasswordLabel={i18n.t("admin.login.password.show")}
                      hidePasswordLabel={i18n.t("admin.login.password.hide")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                  </FieldChrome>
                )}
              </form.Field>

              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <form.Subscribe selector={state => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" className="w-full" disabled={!canSubmit}>
                  {isSubmitting && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {isSubmitting ? i18n.t("admin.login.submitting") : i18n.t("admin.login.submit")}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}

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

export type { AdminLoginFormProps, SignInInput, SignInResult }
