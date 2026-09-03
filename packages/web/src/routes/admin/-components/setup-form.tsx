import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { PasswordInput } from "src/components/ui/password-input"
import { i18n } from "src/i18n"
import { z } from "zod"

interface SetupSignUpInput {
  readonly name: string
  readonly email: string
  readonly password: string
}

interface SetupSignUpResult {
  readonly error: { readonly message?: string | undefined } | null
}

interface AdminSetupFormProps {
  readonly onSignUp: (input: SetupSignUpInput) => Promise<SetupSignUpResult>
  readonly onSetupComplete?: (email: string) => void
}

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

function fieldValidator(schema: z.ZodType<string>) {
  return ({ value }: { value: string }): string | undefined => {
    const result = schema.safeParse(value)
    if (result.success) return undefined
    return result.error.issues[0]?.message
  }
}

function AdminSetupForm({ onSignUp, onSetupComplete }: AdminSetupFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)

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

      const { error } = await onSignUp({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password
      })

      if (error) {
        setServerError(error.message ?? i18n.t("admin.setup.error.server.generic"))
        return
      }

      onSetupComplete?.(parsed.data.email)
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
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors.map(msg => ({ message: String(msg) }))} />
                    )}
                  </Field>
                )}
              </form.Field>

              <form.Field name="email" validators={{ onChange: fieldValidator(setupSchema.shape.email) }}>
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
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors.map(msg => ({ message: String(msg) }))} />
                    )}
                  </Field>
                )}
              </form.Field>

              <form.Field name="password" validators={{ onChange: fieldValidator(setupSchema.shape.password) }}>
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.setup.password.label")}</FieldLabel>
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      showPasswordLabel={i18n.t("admin.setup.password.show")}
                      hidePasswordLabel={i18n.t("admin.setup.password.hide")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors.map(msg => ({ message: String(msg) }))} />
                    )}
                  </Field>
                )}
              </form.Field>

              <form.Field
                name="confirmPassword"
                validators={{
                  onChangeListenTo: ["password"],
                  onChange: ({ value, fieldApi }) => {
                    if (value.length === 0) return i18n.t("admin.setup.error.confirmPassword.required")
                    const password = fieldApi.form.getFieldValue("password")
                    if (value !== password) return i18n.t("admin.setup.error.password.mismatch")
                    return undefined
                  }
                }}
              >
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>{i18n.t("admin.setup.confirmPassword.label")}</FieldLabel>
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      showPasswordLabel={i18n.t("admin.setup.confirmPassword.show")}
                      hidePasswordLabel={i18n.t("admin.setup.confirmPassword.hide")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => {
                        field.handleChange(e.target.value)
                      }}
                    />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors.map(msg => ({ message: String(msg) }))} />
                    )}
                  </Field>
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

export { AdminSetupForm }
export type { AdminSetupFormProps, SetupSignUpInput, SetupSignUpResult }
