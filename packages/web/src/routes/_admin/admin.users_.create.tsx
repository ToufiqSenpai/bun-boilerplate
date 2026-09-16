import type { Role } from "@bun-boilerplate/backend/auth"
import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { PasswordInput } from "src/components/ui/password-input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "src/components/ui/select"
import { i18n } from "src/i18n"
import { ROLE_OPTIONS } from "src/routes/_admin/-users/roles"
import { authClient } from "src/utils/client"
import { z } from "zod"

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18n.t("admin.users.create.error.name.required"))
    .max(64, i18n.t("admin.users.create.error.name.max")),
  email: z
    .email(i18n.t("admin.users.create.error.email.invalid"))
    .max(128, i18n.t("admin.users.create.error.email.max")),
  password: z
    .string()
    .min(8, i18n.t("admin.users.create.error.password.min"))
    .max(128, i18n.t("admin.users.create.error.password.max")),
  role: z.enum(ROLE_OPTIONS, { error: i18n.t("admin.users.create.error.role.required") })
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

  const createUser = useMutation({
    mutationFn: async (input: { name: string; email: string; password: string; role: Role }) => {
      const { error } = await authClient.admin.createUser(input)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      void navigate({ to: "/admin/users" })
    }
  })

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: ""
    },
    validators: { onChange: createUserSchema },
    onSubmit: ({ value }) => {
      createUser.mutate({
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
        // SAFETY: role is only settable through the <Select> whose items come from ROLE_OPTIONS,
        // and the schema rejects any value outside that list before submit runs.
        role: value.role as Role
      })
    }
  })

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{i18n.t("admin.users.create.title")}</h2>
          <p className="text-sm text-muted-foreground">{i18n.t("admin.users.create.description")}</p>
        </div>

        <form
          className="w-full"
          onSubmit={event => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {field => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="create-name">{i18n.t("admin.users.create.name.label")}</FieldLabel>
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
                  {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>

            <form.Field name="email">
              {field => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="create-email">{i18n.t("admin.users.create.email.label")}</FieldLabel>
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
                  {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {field => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="create-password">{i18n.t("admin.users.create.password.label")}</FieldLabel>
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
                  {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>

            <form.Field name="role">
              {field => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="create-role">{i18n.t("admin.users.create.role.label")}</FieldLabel>
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
                  {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>

            {createUser.error && (
              <Alert variant="destructive">
                <AlertDescription>{i18n.t("admin.users.create.error.generic")}</AlertDescription>
              </Alert>
            )}

            <form.Subscribe selector={state => state.canSubmit}>
              {canSubmit => (
                <Button type="submit" className="w-full" disabled={!canSubmit || createUser.isPending}>
                  {createUser.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {createUser.isPending ? i18n.t("admin.users.create.submitting") : i18n.t("admin.users.create.submit")}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
