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
import { isRequiredSetup } from "src/routes/admin/-helpers/setup"
import { authClient } from "src/utils/client"
import { z } from "zod"

const loginSchema = z.object({
  email: z.email(i18n.t("admin.login.error.email.invalid")),
  password: z.string().min(1, i18n.t("admin.login.error.password.required"))
})

const searchSchema = z.object({
  redirect: z
    .string()
    .regex(/^\/admin(?:\/|$)[\x20-\x7E]*$/)
    .catch("/admin/")
    .default("/admin/")
})

export const Route = createFileRoute("/admin/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Admin Login" }]
  }),
  beforeLoad: async ({ search }) => {
    if (await isRequiredSetup()) throw redirect({ to: "/admin/setup" })

    const { data } = await authClient.getSession()
    if (data?.user) throw redirect({ href: search.redirect })
  },
  component: LoginPage
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
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

      const { error } = await authClient.signIn.email({ email: parsed.data.email, password: parsed.data.password })

      if (!error) {
        void navigate({ href: redirect })
        return
      }

      if (error.code === "EMAIL_NOT_VERIFIED") {
        void navigate({ to: "/admin/verify-email", search: { email: parsed.data.email } })
        return
      }

      console.warn("admin sign-in failed", error.code, error.status)
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
