import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserWithRole } from "better-auth/plugins/admin"
import { useState } from "react"
import { Alert, AlertDescription } from "src/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "src/components/ui/alert-dialog"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "src/components/ui/field"
import { PasswordInput } from "src/components/ui/password-input"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"
import { z } from "zod"

const passwordFormSchema = z.object({
  password: z
    .string()
    .min(8, i18n.t("admin.users.detail.password.error.password.min"))
    .max(128, i18n.t("admin.users.detail.password.error.password.max"))
})

interface PasswordSectionProps {
  readonly user: UserWithRole
}

export function PasswordSection({ user }: PasswordSectionProps) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const setPassword = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await authClient.admin.setUserPassword({ userId: user.id, newPassword: password })

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      form.reset()
    },
    onSettled: () => {
      setConfirmOpen(false)
    }
  })

  const form = useForm({
    defaultValues: { password: "" },
    validators: { onChange: passwordFormSchema },
    onSubmit: () => {
      setConfirmOpen(true)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.password.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={event => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldGroup className="gap-2">
            <form.Field name="password">
              {field => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="user-password">{i18n.t("admin.users.detail.newPassword")}</FieldLabel>
                  <PasswordInput
                    id="user-password"
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

            {setPassword.error && (
              <Alert variant="destructive">
                <AlertDescription>{i18n.t("admin.users.detail.password.error.generic")}</AlertDescription>
              </Alert>
            )}

            <form.Subscribe selector={state => state.canSubmit}>
              {canSubmit => (
                <Button type="submit" size="sm" className="self-start" disabled={!canSubmit || setPassword.isPending}>
                  {setPassword.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {setPassword.isPending
                    ? i18n.t("admin.users.detail.saving")
                    : i18n.t("admin.users.detail.resetPassword")}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
        <AlertDialog
          open={confirmOpen}
          onOpenChange={nextOpen => {
            if (!nextOpen) setConfirmOpen(false)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t("admin.users.detail.confirm.setPassword.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("admin.users.detail.confirm.setPassword.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={setPassword.isPending}>
                {i18n.t("admin.users.detail.confirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={setPassword.isPending}
                onClick={() => {
                  setPassword.mutate(form.state.values.password)
                }}
              >
                {setPassword.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {i18n.t("admin.users.detail.confirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
