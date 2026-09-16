import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
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
  const navigate = useNavigate()

  const signUp = useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) => {
      const { error } = await authClient.signUp.email(input)
      if (error) throw error
    },
    onSuccess: (_data, input) => {
      void navigate({ to: "/admin/verify-email", search: { email: input.email } })
    }
  })

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    },
    validators: { onChange: setupSchema },
    onSubmit: ({ value }) => {
      signUp.mutate({ name: value.name, email: value.email, password: value.password })
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
              <form.Field name="name">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.setup.name.label")}</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                    {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )}
              </form.Field>

              <form.Field name="email">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.setup.email.label")}</FieldLabel>
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
                    {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )}
              </form.Field>

              <form.Field name="password">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.setup.password.label")}</FieldLabel>
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
                    {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )}
              </form.Field>

              <form.Field name="confirmPassword">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.setup.confirmPassword.label")}</FieldLabel>
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
                    {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )}
              </form.Field>

              {signUp.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {signUp.error.message || i18n.t("admin.setup.error.server.generic")}
                  </AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <form.Subscribe selector={state => state.canSubmit}>
              {canSubmit => (
                <Button type="submit" className="w-full" disabled={!canSubmit || signUp.isPending}>
                  {signUp.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {signUp.isPending ? i18n.t("admin.setup.submitting") : i18n.t("admin.setup.submit")}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
