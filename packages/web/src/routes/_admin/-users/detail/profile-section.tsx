import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserWithRole } from "better-auth/plugins/admin"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"
import { z } from "zod"

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18n.t("admin.users.detail.profile.error.name.required"))
    .max(64, i18n.t("admin.users.detail.profile.error.name.max"))
})

interface ProfileSectionProps {
  readonly user: UserWithRole
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const queryClient = useQueryClient()

  const updateName = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await authClient.admin.updateUser({ userId: user.id, data: { name } })

      if (error) throw error
    },
    onSuccess: async (_data, name) => {
      await queryClient.invalidateQueries({ queryKey: ["user", user.id] })
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      form.reset({ name })
    }
  })

  const form = useForm({
    defaultValues: { name: user.name },
    validators: { onChange: profileSchema },
    onSubmit: ({ value }) => {
      updateName.mutate(value.name.trim())
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.profile.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
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
                  <FieldLabel htmlFor="user-name">{i18n.t("admin.users.detail.nameLabel")}</FieldLabel>
                  <Input
                    id="user-name"
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

            {updateName.error && (
              <Alert variant="destructive">
                <AlertDescription>{i18n.t("admin.users.detail.profile.error.generic")}</AlertDescription>
              </Alert>
            )}

            <form.Subscribe selector={state => state.canSubmit && state.values.name.trim() !== user.name}>
              {canSave => (
                <Button type="submit" size="sm" className="self-start" disabled={!canSave || updateName.isPending}>
                  {updateName.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {updateName.isPending ? i18n.t("admin.users.detail.saving") : i18n.t("admin.users.detail.save")}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
