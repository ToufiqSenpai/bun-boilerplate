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
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"

interface RemoveSectionProps {
  readonly user: UserWithRole
}

export function RemoveSection({ user }: RemoveSectionProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.removeUser({ userId: user.id })

      if (error) throw error
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["user", user.id] })
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      await navigate({ to: "/admin/users" })
    },
    onSettled: () => {
      setConfirmOpen(false)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.remove.title")}</CardTitle>
        <CardDescription>{i18n.t("admin.users.detail.remove.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {remove.error && (
          <Alert variant="destructive">
            <AlertDescription>{i18n.t("admin.users.detail.remove.error.generic")}</AlertDescription>
          </Alert>
        )}

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
            if (!nextOpen) setConfirmOpen(false)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t("admin.users.detail.confirm.remove.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("admin.users.detail.confirm.remove.description", { email: user.email })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>
                {i18n.t("admin.users.detail.confirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={remove.isPending}
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
