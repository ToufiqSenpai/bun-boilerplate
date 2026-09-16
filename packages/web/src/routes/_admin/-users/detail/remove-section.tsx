import { IconLoader2 } from "@tabler/icons-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"

interface RemoveSectionProps {
  readonly user: UserWithRole
}

export function RemoveSection({ user }: RemoveSectionProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.removeUser({ userId: user.id })

      if (error) throw error
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["user", user.id] })
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      await navigate({ to: "/admin/users" })
    }
  })

  const confirmed = confirmText.trim().toLowerCase() === i18n.t("admin.users.detail.confirm.remove.word").toLowerCase()

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">{i18n.t("admin.users.detail.remove.title")}</CardTitle>
        <CardDescription>{i18n.t("admin.users.detail.remove.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="self-start"
          disabled={remove.isPending}
          onClick={() => {
            setConfirmOpen(true)
          }}
        >
          {remove.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
          {remove.isPending ? i18n.t("admin.users.detail.remove.removing") : i18n.t("admin.users.detail.remove.action")}
        </Button>

        <AlertDialog
          open={confirmOpen}
          onOpenChange={nextOpen => {
            setConfirmOpen(nextOpen)
            if (!nextOpen) setConfirmText("")
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t("admin.users.detail.confirm.remove.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("admin.users.detail.confirm.remove.description", { email: user.email })}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="remove-confirm">
                  {i18n.t("admin.users.detail.confirm.remove.inputLabel")}
                </FieldLabel>
                <Input
                  id="remove-confirm"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={confirmText}
                  onChange={event => {
                    setConfirmText(event.target.value)
                  }}
                />
              </Field>
            </FieldGroup>

            {remove.error && (
              <Alert variant="destructive">
                <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
              </Alert>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>
                {i18n.t("admin.users.detail.confirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={remove.isPending || !confirmed}
                onClick={() => {
                  remove.mutate()
                }}
              >
                {remove.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {i18n.t("admin.users.detail.confirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
