import { useForm } from "@tanstack/react-form"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { i18n } from "src/i18n"
import { z } from "zod"

const requestSchema = z.object({
  email: z.email(i18n.t("admin.passwordReset.request.error.email.invalid"))
})

export const Route = createFileRoute("/admin/forgot-password")({
  head: () => ({
    meta: [{ title: i18n.t("admin.passwordReset.request.title") }]
  }),
  component: ForgotPasswordPage
})

function ForgotPasswordPage() {
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      email: ""
    },
    validators: { onChange: requestSchema },
    onSubmit: ({ value }) => {
      void navigate({ to: "/admin/forgot-password/sent", search: { email: value.email } })
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {i18n.t("admin.passwordReset.request.title")}
          </CardTitle>
          <CardDescription className="text-balance">
            {i18n.t("admin.passwordReset.request.description")}
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
              <form.Field name="email">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.passwordReset.request.email.label")}</FieldLabel>
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
                    {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-2">
            <form.Subscribe selector={state => state.canSubmit}>
              {canSubmit => (
                <Button type="submit" className="w-full" disabled={!canSubmit}>
                  {i18n.t("admin.passwordReset.request.submit")}
                </Button>
              )}
            </form.Subscribe>
            <Button
              render={<Link to="/admin/login" />}
              nativeButton={false}
              variant="link"
              className="text-muted-foreground"
            >
              {i18n.t("admin.passwordReset.request.backToSignIn")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
