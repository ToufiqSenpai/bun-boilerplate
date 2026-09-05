import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { FieldGroup } from "src/components/ui/field"
import { FieldChrome, fieldValidator } from "src/components/ui/field-chrome"
import { Input } from "src/components/ui/input"
import { PasswordInput } from "src/components/ui/password-input"
import { i18n } from "src/i18n"
import { classifySignInError, resolveAdminAccess, sanitizeReturnAddress } from "src/routes/admin/-lib/access"
import { readAdminSession } from "src/routes/admin/-lib/session-reader"
import type { SetupStatusResult } from "src/routes/admin/setup"
import { api, authClient } from "src/utils/client"
import { z } from "zod"

interface SignInResult {
  readonly error: {
    readonly code?: string | undefined
    readonly status?: number | undefined
    readonly message?: string | undefined
  } | null
}

export interface AdminLoginPageProps {
  readonly onSignIn?: (input: { readonly email: string; readonly password: string }) => Promise<SignInResult>
  readonly onSignedIn: (returnTo: string) => void
  readonly onGoToPending: (email: string) => void
  readonly returnTo?: string | undefined
}

const loginSchema = z.object({
  email: z.email(i18n.t("admin.login.error.email.invalid")),
  password: z.string().min(1, i18n.t("admin.login.error.password.required"))
})

export function requireSetupComplete(result: SetupStatusResult): void {
  const { data, error, status } = result

  if (error === null && status === 200 && data?.needed) throw redirect({ to: "/admin/setup" })
}

const loginSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .transform(raw => (raw === undefined ? undefined : sanitizeReturnAddress(raw)))
})

export const Route = createFileRoute("/admin/login")({
  validateSearch: loginSearchSchema,
  head: () => ({
    meta: [{ title: "Admin Login" }]
  }),
  beforeLoad: async ({ location }) => {
    const setup = await api.auth.setup.get()
    requireSetupComplete(setup)

    const access = resolveAdminAccess(setup, await readAdminSession())

    if (access === "allowed") {
      // SAFETY: the router has already validated location.search through loginSearchSchema, so `redirect` is either a sanitized admin path or absent.
      const requested = (location.search as { redirect?: string | undefined }).redirect
      throw redirect({ href: sanitizeReturnAddress(requested) })
    }
  },
  component: AdminLoginRoute
})

function AdminLoginRoute() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()

  return (
    <AdminLoginPage
      returnTo={redirect}
      onSignedIn={target => {
        void navigate({ href: target })
      }}
      onGoToPending={email => {
        void navigate({ to: "/admin/setup", search: { email } })
      }}
    />
  )
}

export function AdminLoginPage({ onSignIn, onSignedIn, onGoToPending, returnTo }: AdminLoginPageProps) {
  const signIn =
    onSignIn ??
    (async input => {
      const { error } = await authClient.signIn.email(input)
      return { error }
    })
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

      const { error } = await signIn({ email: parsed.data.email, password: parsed.data.password })

      if (!error) {
        onSignedIn(sanitizeReturnAddress(returnTo))
        return
      }

      const failure = classifySignInError(error)

      if (failure.reason === "pending-verification") {
        onGoToPending(parsed.data.email)
        return
      }

      console.warn("admin sign-in failed", failure)
      setServerError(i18n.t("admin.login.error.invalidCredentials"))
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

export type { SignInResult }
