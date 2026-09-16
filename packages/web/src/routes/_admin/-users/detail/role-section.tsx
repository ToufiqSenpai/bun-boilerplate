import type { Role } from "@bun-boilerplate/backend/auth"
import { IconLoader2 } from "@tabler/icons-react"
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "src/components/ui/select"
import { i18n } from "src/i18n"
import { ROLE_OPTIONS } from "src/routes/_admin/-users/roles"
import { authClient } from "src/utils/client"
import { z } from "zod"

interface RoleSectionProps {
  readonly user: UserWithRole
}

export function RoleSection({ user }: RoleSectionProps) {
  const queryClient = useQueryClient()
  const [role, setRole] = useState<Role | null>(() => z.enum(ROLE_OPTIONS).safeParse(user.role).data ?? null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const changeRole = useMutation({
    mutationFn: async (nextRole: Role) => {
      const { error } = await authClient.admin.setRole({ userId: user.id, role: nextRole })

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user", user.id] })
      await queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onSettled: () => {
      setConfirmOpen(false)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.role.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="user-role" aria-label={i18n.t("admin.users.detail.role.title")} className="w-full">
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

        {changeRole.error && (
          <Alert variant="destructive">
            <AlertDescription>{i18n.t("admin.users.detail.role.error.generic")}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          size="sm"
          className="self-start"
          disabled={!role || changeRole.isPending}
          onClick={() => {
            setConfirmOpen(true)
          }}
        >
          {changeRole.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
          {changeRole.isPending ? i18n.t("admin.users.detail.saving") : i18n.t("admin.users.detail.changeRole")}
        </Button>
        <AlertDialog
          open={confirmOpen}
          onOpenChange={nextOpen => {
            if (!nextOpen) setConfirmOpen(false)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t("admin.users.detail.confirm.changeRole.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("admin.users.detail.confirm.changeRole.description", { role: role ?? "" })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={changeRole.isPending}>
                {i18n.t("admin.users.detail.confirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={changeRole.isPending}
                onClick={() => {
                  if (role) changeRole.mutate(role)
                }}
              >
                {changeRole.isPending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {i18n.t("admin.users.detail.confirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
