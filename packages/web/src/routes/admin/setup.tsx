import { useForm } from "@tanstack/react-form"
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { api, authClient } from "src/utils/client"
import { z } from "zod"

const setupSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(64, "Name must be at most 64 characters"),
    email: z.email("Invalid email").max(128, "Email must be at most 128 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required")
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  })

type SetupValues = z.infer<typeof setupSchema>

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [{ title: "Admin Setup" }]
  }),
  loader: async () => {
    const { data, error, status } = await api.auth.setup.get()

    if (error !== null || status !== 200 || !data.needed) throw notFound()

    return data
  },
  component: AdminSetupPage
})

function AdminSetupPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SetupValues>({
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
        setServerError(firstIssue?.message ?? "Validation failed")
        return
      }

      const { error } = await authClient.signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password
      })

      if (error) {
        setServerError(error.message ?? "Failed to create admin")
        return
      }

      void navigate({ to: "/admin/login" })
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>Create the initial admin account. This can only be done once.</CardDescription>
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
              <form.Field
                name="name"
                validators={{
                  onChange: ({ value }) => {
                    const result = z.string().min(1, "Name is required").max(64).safeParse(value)
                    return result.success ? undefined : result.error.issues[0]?.message
                  }
                }}
              >
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
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

              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }) => {
                    const result = z.email("Invalid email").max(128).safeParse(value)
                    return result.success ? undefined : result.error.issues[0]?.message
                  }
                }}
              >
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
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

              <form.Field
                name="password"
                validators={{
                  onChange: ({ value }) => {
                    const result = z.string().min(8, "Password must be at least 8 characters").max(128).safeParse(value)
                    return result.success ? undefined : result.error.issues[0]?.message
                  }
                }}
              >
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
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
                    const password = fieldApi.form.getFieldValue("password")
                    if (value !== password) return "Passwords do not match"
                    if (value.length === 0) return "Confirm password is required"
                    return undefined
                  }
                }}
              >
                {field => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
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

              {serverError && <FieldError errors={[{ message: serverError }]} />}
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <form.Subscribe selector={state => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" className="w-full" disabled={!canSubmit}>
                  {isSubmitting ? "Creating..." : "Create admin"}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
