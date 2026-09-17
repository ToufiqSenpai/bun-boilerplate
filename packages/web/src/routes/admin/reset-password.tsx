import { IconAlertTriangle, IconCircleCheck, IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
import { PasswordInput } from "src/components/ui/password-input"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"
import { z } from "zod"

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, i18n.t("admin.passwordReset.confirm.error.password.min"))
      .max(128, i18n.t("admin.passwordReset.confirm.error.password.max")),
    confirmPassword: z.string().min(1, i18n.t("admin.passwordReset.confirm.error.confirmPassword.required"))
  })
  .refine(data => data.password === data.confirmPassword, {
    message: i18n.t("admin.passwordReset.confirm.error.confirmPassword.mismatch"),
    path: ["confirmPassword"]
  })

const resetSearchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional()
})

export const Route = createFileRoute("/admin/reset-password")({
  validateSearch: resetSearchSchema,
  head: () => ({
    meta: [{ title: i18n.t("admin.passwordReset.confirm.title") }]
  }),
  component: ResetPasswordPage
})

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch()

  const resetPassword = useMutation<void, { status?: number }, { newPassword: string }>({
    mutationFn: async input => {
      const { error } = await authClient.resetPassword({ newPassword: input.newPassword, token })
      if (error) throw error
    }
  })

  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: ""
    },
    validators: { onChange: resetSchema },
    onSubmit: ({ value }) => {
      resetPassword.mutate({ newPassword: value.password })
    }
  })

  if (!token || linkError || resetPassword.error?.status === 400) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm border shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <IconAlertTriangle className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {i18n.t("admin.passwordReset.confirm.invalid.title")}
            </CardTitle>
            <CardDescription className="text-balance [overflow-wrap:anywhere]">
              {i18n.t("admin.passwordReset.confirm.invalid.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link to="/admin/forgot-password" />} nativeButton={false} className="w-full">
              {i18n.t("admin.passwordReset.confirm.invalid.requestNew")}
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (resetPassword.isSuccess) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm border shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <IconCircleCheck className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {i18n.t("admin.passwordReset.confirm.success.title")}
            </CardTitle>
            <CardDescription className="text-balance">
              {i18n.t("admin.passwordReset.confirm.success.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link to="/admin/login" />} nativeButton={false} className="w-full">
              {i18n.t("admin.passwordReset.confirm.success.signIn")}
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {i18n.t("admin.passwordReset.confirm.title")}
          </CardTitle>
          <CardDescription className="text-balance">
            {i18n.t("admin.passwordReset.confirm.description")}
          </CardDescription>
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
              <form.Field name="password">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.passwordReset.confirm.password.label")}</FieldLabel>
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
                      showPasswordLabel={i18n.t("admin.passwordReset.confirm.password.show")}
                      hidePasswordLabel={i18n.t("admin.passwordReset.confirm.password.hide")}
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
                    <FieldLabel htmlFor={field.name}>
                      {i18n.t("admin.passwordReset.confirm.confirmPassword.label")}
                    </FieldLabel>
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
                      showPasswordLabel={i18n.t("admin.passwordReset.confirm.confirmPassword.show")}
                      hidePasswordLabel={i18n.t("admin.passwordReset.confirm.confirmPassword.hide")}
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

              {resetPassword.error && (
                <Alert variant="destructive">
                  <AlertDescription>{i18n.t("admin.setup.error.server.generic")}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <form.Subscribe selector={state => state.canSubmit}>
              {canSubmit => (
                <Button type="submit" className="w-full" disabled={!canSubmit || resetPassword.isPending}>
                  {resetPassword.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {resetPassword.isPending
                    ? i18n.t("admin.passwordReset.confirm.submitting")
                    : i18n.t("admin.passwordReset.confirm.submit")}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
