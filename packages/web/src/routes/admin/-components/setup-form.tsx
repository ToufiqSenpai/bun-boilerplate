import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import type { ReactNode } from "react"
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

interface ConfirmPasswordFieldApi {
  readonly form: {
    getFieldValue(field: string): string
  }
}

function confirmPasswordValidator({
  value,
  fieldApi
}: {
  value: string
  fieldApi: ConfirmPasswordFieldApi
}): string | undefined {
  if (value.length === 0) return i18n.t("admin.setup.error.confirmPassword.required")
  const password = fieldApi.form.getFieldValue("password")
  if (value !== password) return i18n.t("admin.setup.error.password.mismatch")
  return undefined
}

interface FieldChromeProps {
  readonly id: string
  readonly label: string
  readonly touched: boolean
  readonly messages: readonly string[]
  readonly children: ReactNode
}

function FieldChrome({ id, label, touched, messages, children }: FieldChromeProps) {
  return (
    <Field data-invalid={messages.length > 0}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {touched && messages.length > 0 && <FieldError errors={messages.map(message => ({ message }))} />}
    </Field>
  )
}

interface PasswordFieldConfig {
  readonly name: "password" | "confirmPassword"
  readonly label: string
  readonly showLabel: string
  readonly hideLabel: string
}

const passwordFieldConfigs: readonly PasswordFieldConfig[] = [
  {
    name: "password",
    label: i18n.t("admin.setup.password.label"),
    showLabel: i18n.t("admin.setup.password.show"),
    hideLabel: i18n.t("admin.setup.password.hide")
  },
  {
    name: "confirmPassword",
    label: i18n.t("admin.setup.confirmPassword.label"),
    showLabel: i18n.t("admin.setup.confirmPassword.show"),
    hideLabel: i18n.t("admin.setup.confirmPassword.hide")
  }
]

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

              {passwordFieldConfigs.map(config => (
                <form.Field
                  key={config.name}
                  name={config.name}
                  validators={
                    config.name === "password"
                      ? { onChange: fieldValidator(setupSchema.shape.password) }
                      : {
                          onChangeListenTo: ["password"],
                          onChange: confirmPasswordValidator
                        }
                  }
                >
                  {field => (
                    <FieldChrome
                      id={field.name}
                      label={config.label}
                      touched={field.state.meta.isTouched}
                      messages={field.state.meta.errors.map(String)}
                    >
                      <PasswordInput
                        id={field.name}
                        name={field.name}
                        autoComplete="new-password"
                        showPasswordLabel={config.showLabel}
                        hidePasswordLabel={config.hideLabel}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={e => {
                          field.handleChange(e.target.value)
                        }}
                      />
                    </FieldChrome>
                  )}
                </form.Field>
              ))}

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
