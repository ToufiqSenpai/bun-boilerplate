import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
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
  const signIn = useMutation<void, { code?: string; status?: number }, { email: string; password: string }>({
    mutationFn: async input => {
      const { error } = await authClient.signIn.email(input)
      if (error) throw error
    },
    onSuccess: () => {
      void navigate({ href: redirect })
    },
    onError: (error, input) => {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        void navigate({ to: "/admin/verify-email", search: { email: input.email } })
      }
    }
  })

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
    validators: { onChange: loginSchema },
    onSubmit: ({ value }) => {
      signIn.mutate(value)
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
              <form.Field name="email">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.login.email.label")}</FieldLabel>
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

              <form.Field name="password">
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.login.password.label")}</FieldLabel>
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
                    {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )}
              </form.Field>

              {signIn.error && signIn.error.code !== "EMAIL_NOT_VERIFIED" && (
                <Alert variant="destructive">
                  <AlertDescription>{i18n.t("admin.login.error.invalidCredentials")}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-2">
            <form.Subscribe selector={state => state.canSubmit}>
              {canSubmit => (
                <Button type="submit" className="w-full" disabled={!canSubmit || signIn.isPending}>
                  {signIn.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {signIn.isPending ? i18n.t("admin.login.submitting") : i18n.t("admin.login.submit")}
                </Button>
              )}
            </form.Subscribe>
            <Button
              render={<Link to="/admin/forgot-password" />}
              nativeButton={false}
              variant="link"
              className="text-muted-foreground"
            >
              {i18n.t("admin.login.forgotPassword")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
