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

const setupSchema = z
  .object({
    name: z.string().min(1, i18n.t("admin.setup.error.name.required")).max(64, i18n.t("admin.setup.error.name.max")),
    email: z.email(i18n.t("admin.setup.error.email.invalid")).max(128, i18n.t("admin.setup.error.email.max")),
    password: z
      .string()
      .min(8, i18n.t("admin.setup.error.password.min"))
      .max(128, i18n.t("admin.setup.error.password.max")),
    confirmPassword: z.string().min(1, i18n.t("admin.setup.error.confirmPassword.required"))
  })
  .refine(data => data.password === data.confirmPassword, {
    message: i18n.t("admin.setup.error.password.mismatch"),
    path: ["confirmPassword"]
  })

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [{ title: "Admin Setup" }]
  }),
  loader: async () => {
    if (!(await isRequiredSetup())) throw redirect({ to: "/admin/login" })
  },
  component: SetupPage
})

function SetupPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    },
    onSubmit: async ({ value }) => {
      setServerError(null)

      const parsed = setupSchema.safeParse(value)

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]
        setServerError(firstIssue?.message ?? i18n.t("admin.setup.error.server.generic"))
        return
      }

      const { error } = await authClient.signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password
      })

      if (error) {
        setServerError(error.message ?? i18n.t("admin.setup.error.server.generic"))
        return
      }

      void navigate({ to: "/admin/verify-email", search: { email: parsed.data.email } })
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">{i18n.t("admin.setup.title")}</CardTitle>
          <CardDescription className="text-balance">{i18n.t("admin.setup.description")}</CardDescription>
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
              <form.Field name="name" validators={{ onChange: fieldValidator(setupSchema.shape.name) }}>
                {field => (
                  <FieldChrome
                    id={field.name}
                    label={i18n.t("admin.setup.name.label")}
                    touched={field.state.meta.isTouched}
                    messages={field.state.meta.errors.map(String)}
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                  </FieldChrome>
                )}
              </form.Field>

              <form.Field name="email" validators={{ onChange: fieldValidator(setupSchema.shape.email) }}>
                {field => (
                  <FieldChrome
                    id={field.name}
                    label={i18n.t("admin.setup.email.label")}
                    touched={field.state.meta.isTouched}
                    messages={field.state.meta.errors.map(String)}
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                  </FieldChrome>
                )}
              </form.Field>

              <form.Field name="password" validators={{ onChange: fieldValidator(setupSchema.shape.password) }}>
                {field => (
                  <FieldChrome
                    id={field.name}
                    label={i18n.t("admin.setup.password.label")}
                    touched={field.state.meta.isTouched}
                    messages={field.state.meta.errors.map(String)}
                  >
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
                      showPasswordLabel={i18n.t("admin.setup.password.show")}
                      hidePasswordLabel={i18n.t("admin.setup.password.hide")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                  </FieldChrome>
                )}
              </form.Field>

              <form.Field
                name="confirmPassword"
                validators={{
                  onChangeListenTo: ["password"],
                  onChange: ({ value, fieldApi }) => {
                    if (value.length === 0) return i18n.t("admin.setup.error.confirmPassword.required")
                    if (value === fieldApi.form.getFieldValue("password")) return undefined
                    return i18n.t("admin.setup.error.password.mismatch")
                  }
                }}
              >
                {field => (
                  <FieldChrome
                    id={field.name}
                    label={i18n.t("admin.setup.confirmPassword.label")}
                    touched={field.state.meta.isTouched}
                    messages={field.state.meta.errors.map(String)}
                  >
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
                      showPasswordLabel={i18n.t("admin.setup.confirmPassword.show")}
                      hidePasswordLabel={i18n.t("admin.setup.confirmPassword.hide")}
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
                  {isSubmitting ? i18n.t("admin.setup.submitting") : i18n.t("admin.setup.submit")}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
