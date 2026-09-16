import { IconCalendar, IconLoader2 } from "@tabler/icons-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserWithRole } from "better-auth/plugins/admin"
import { useState } from "react"
import { enUS, id as idLocale } from "react-day-picker/locale"
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
import { Calendar } from "src/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "src/components/ui/popover"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"
import { formatDate } from "src/utils/date"

function secondsUntilEndOfDay(date: Date): number {
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)

  return Math.max(1, Math.round((end.getTime() - Date.now()) / 1000))
}

const betterAuthDefaultBanReason = "No reason"

interface BanSectionProps {
  readonly user: UserWithRole
}

export function BanSection({ user }: BanSectionProps) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [expires, setExpires] = useState<Date | undefined>(undefined)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const banned = user.banned ?? false
  const dayPickerLocale = i18n.language === "id" ? idLocale : enUS

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["user", user.id] })
    await queryClient.invalidateQueries({ queryKey: ["users"] })
    await queryClient.invalidateQueries({ queryKey: ["user-sessions", user.id] })
  }

  const ban = useMutation({
    mutationFn: async () => {
      const payload: Parameters<typeof authClient.admin.banUser>[0] = { userId: user.id }
      const trimmedReason = reason.trim()
      const banExpiresIn = expires ? secondsUntilEndOfDay(expires) : undefined

      if (trimmedReason !== "") payload.banReason = trimmedReason
      if (banExpiresIn !== undefined) payload.banExpiresIn = banExpiresIn

      const { error } = await authClient.admin.banUser(payload)

      if (error) throw error
    },
    onSuccess: async () => {
      setReason("")
      setExpires(undefined)
      await invalidate()
    },
    onSettled: () => {
      setConfirmOpen(false)
    }
  })

  const unban = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.unbanUser({ userId: user.id })

      if (error) throw error
    },
    onSuccess: invalidate,
    onSettled: () => {
      setConfirmOpen(false)
    }
  })

  const pending = ban.isPending || unban.isPending
  let actionLabel = banned ? i18n.t("admin.users.detail.ban.unban") : i18n.t("admin.users.detail.ban.action")

  if (pending) {
    actionLabel = banned ? i18n.t("admin.users.detail.ban.unbanning") : i18n.t("admin.users.detail.ban.banning")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.ban.title")}</CardTitle>
        <CardDescription>{i18n.t("admin.users.detail.ban.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {banned ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{i18n.t("admin.users.detail.ban.reasonLabel")}</span>
              <span className="text-sm">
                {user.banReason && user.banReason !== betterAuthDefaultBanReason
                  ? user.banReason
                  : i18n.t("admin.users.detail.ban.noReason")}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{i18n.t("admin.users.detail.expires")}</span>
              <span className="text-sm">
                {user.banExpires ? formatDate(user.banExpires) : i18n.t("admin.users.detail.ban.expiryPlaceholder")}
              </span>
            </div>
          </div>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ban-reason">{i18n.t("admin.users.detail.ban.reasonLabel")}</FieldLabel>
              <Input
                id="ban-reason"
                value={reason}
                placeholder={i18n.t("admin.users.detail.ban.reasonPlaceholder")}
                onChange={event => {
                  setReason(event.target.value)
                }}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="ban-expires">{i18n.t("admin.users.detail.ban.expiryLabel")}</FieldLabel>
              <div className="flex items-center gap-2">
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger
                    render={<Button variant="outline" id="ban-expires" className="flex-1 justify-start font-normal" />}
                  >
                    <IconCalendar data-icon="inline-start" />
                    {expires ? formatDate(expires) : i18n.t("admin.users.detail.ban.expiryPlaceholder")}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      locale={dayPickerLocale}
                      selected={expires}
                      onSelect={date => {
                        setExpires(date)
                        setPickerOpen(false)
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={expires ? undefined : "invisible"}
                  onClick={() => {
                    setExpires(undefined)
                  }}
                >
                  {i18n.t("admin.users.detail.ban.clearExpiry")}
                </Button>
              </div>
            </Field>
          </FieldGroup>
        )}

        {(ban.error || unban.error) && (
          <Alert variant="destructive">
            <AlertDescription>{i18n.t("admin.users.detail.ban.error.generic")}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          size="sm"
          variant={banned ? "outline" : "destructive"}
          className="self-start"
          disabled={pending}
          onClick={() => {
            setConfirmOpen(true)
          }}
        >
          {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
          {actionLabel}
        </Button>

        <AlertDialog
          open={confirmOpen}
          onOpenChange={nextOpen => {
            if (!nextOpen) setConfirmOpen(false)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {banned
                  ? i18n.t("admin.users.detail.confirm.unban.title")
                  : i18n.t("admin.users.detail.confirm.ban.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {banned
                  ? i18n.t("admin.users.detail.confirm.unban.description")
                  : i18n.t("admin.users.detail.confirm.ban.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>{i18n.t("admin.users.detail.confirm.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant={banned ? "outline" : "destructive"}
                disabled={pending}
                onClick={() => {
                  if (banned) {
                    unban.mutate()
                  } else {
                    ban.mutate()
                  }
                }}
              >
                {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {i18n.t("admin.users.detail.confirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
