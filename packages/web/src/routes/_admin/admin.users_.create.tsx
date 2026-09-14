import { isKnownRole } from "@bun-boilerplate/backend/auth"
import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { FieldGroup } from "src/components/ui/field"
import { FieldChrome, fieldValidator } from "src/components/ui/field-chrome"
import { Input } from "src/components/ui/input"
import { PasswordInput } from "src/components/ui/password-input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "src/components/ui/select"
import { i18n } from "src/i18n"
import { ROLE_OPTIONS } from "src/routes/_admin/-users/roles"
import { userEmailSchema, userNameSchema, userPasswordSchema, userRoleSchema } from "src/routes/_admin/-users/schemas"
import { authClient } from "src/utils/client"
import { z } from "zod"

const createUserSchema = z.object({
  name: userNameSchema,
  email: userEmailSchema,
  password: userPasswordSchema,
  role: userRoleSchema
})

export const Route = createFileRoute("/_admin/admin/users_/create")({
  head: () => ({
    meta: [{ title: "Admin Create User" }]
  }),
  beforeLoad: ({ context }) => {
    const role = context.userSession.role

    if (!authClient.admin.checkRolePermission({ role, permissions: { user: ["create"] } })) throw notFound()
  },
  component: CreateUserPage
})

function CreateUserPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState(false)

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: ""
    },
    onSubmit: async ({ value }) => {
      setServerError(false)

      const parsed = createUserSchema.safeParse(value)

      if (!parsed.success) return

      const role = parsed.data.role

      if (!isKnownRole(role)) return

      const { error } = await authClient.admin.createUser({
        name: parsed.data.name,
        email: parsed.data.email.trim(),
        password: parsed.data.password,
        role
      })

      if (error) {
        setServerError(true)
        return
      }

      await queryClient.invalidateQueries({ queryKey: ["users"] })
      void navigate({ to: "/admin/users" })
    }
  })

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{i18n.t("admin.users.create.title")}</h2>
        <p className="text-sm text-muted-foreground">{i18n.t("admin.users.create.description")}</p>
      </div>

      <form
        className="w-full max-w-md"
        onSubmit={event => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="name" validators={{ onChange: fieldValidator(createUserSchema.shape.name) }}>
            {field => (
              <FieldChrome
                id="create-name"
                label={i18n.t("admin.users.create.name.label")}
                touched={field.state.meta.isTouched}
                messages={field.state.meta.errors.map(String)}
              >
                <Input
                  id="create-name"
                  name={field.name}
                  autoComplete="name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={event => {
                    field.handleChange(event.target.value)
                  }}
                />
              </FieldChrome>
            )}
          </form.Field>

          <form.Field name="email" validators={{ onChange: fieldValidator(createUserSchema.shape.email) }}>
            {field => (
              <FieldChrome
                id="create-email"
                label={i18n.t("admin.users.create.email.label")}
                touched={field.state.meta.isTouched}
                messages={field.state.meta.errors.map(String)}
              >
                <Input
                  id="create-email"
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={event => {
                    field.handleChange(event.target.value)
                  }}
                />
              </FieldChrome>
            )}
          </form.Field>

          <form.Field name="password" validators={{ onChange: fieldValidator(createUserSchema.shape.password) }}>
            {field => (
              <FieldChrome
                id="create-password"
                label={i18n.t("admin.users.create.password.label")}
                touched={field.state.meta.isTouched}
                messages={field.state.meta.errors.map(String)}
              >
                <PasswordInput
                  id="create-password"
                  name={field.name}
                  autoComplete="new-password"
                  showPasswordLabel={i18n.t("admin.users.create.password.show")}
                  hidePasswordLabel={i18n.t("admin.users.create.password.hide")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={event => {
                    field.handleChange(event.target.value)
                  }}
                />
              </FieldChrome>
            )}
          </form.Field>

          <form.Field name="role" validators={{ onChange: fieldValidator(createUserSchema.shape.role) }}>
            {field => (
              <FieldChrome
                id="create-role"
                label={i18n.t("admin.users.create.role.label")}
                touched={field.state.meta.isTouched}
                messages={field.state.meta.errors.map(String)}
              >
                <Select
                  value={field.state.value === "" ? null : field.state.value}
                  onValueChange={value => {
                    field.handleChange(value ?? "")
                  }}
                >
                  <SelectTrigger id="create-role" className="w-full">
                    <SelectValue placeholder={i18n.t("admin.users.create.role.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ROLE_OPTIONS.map(option => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldChrome>
            )}
          </form.Field>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" render={<Link to="/admin/users" />}>
              {i18n.t("admin.users.create.cancel")}
            </Button>
            <form.Subscribe selector={state => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {isSubmitting ? i18n.t("admin.users.create.submitting") : i18n.t("admin.users.create.submit")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}
