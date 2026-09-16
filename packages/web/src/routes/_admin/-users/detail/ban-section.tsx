import { IconCalendar, IconLoader2 } from "@tabler/icons-react"
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
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

async function invalidateUserQueries(queryClient: QueryClient, userId: string): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ["user", userId] })
  await queryClient.invalidateQueries({ queryKey: ["users"] })
  await queryClient.invalidateQueries({ queryKey: ["user-sessions", userId] })
}

function banActionLabel(banned: boolean, pending: boolean): string {
  if (banned) {
    return pending ? i18n.t("admin.users.detail.ban.unbanning") : i18n.t("admin.users.detail.ban.unban")
  }

  return pending ? i18n.t("admin.users.detail.ban.banning") : i18n.t("admin.users.detail.ban.action")
}

function banActionVariant(banned: boolean): "outline" | "destructive" {
  return banned ? "outline" : "destructive"
}

interface BanSummaryProps {
  readonly user: UserWithRole
}

function BanSummary({ user }: BanSummaryProps) {
  const reason =
    user.banReason && user.banReason !== betterAuthDefaultBanReason
      ? user.banReason
      : i18n.t("admin.users.detail.ban.noReason")
  const expires = user.banExpires ? formatDate(user.banExpires) : i18n.t("admin.users.detail.ban.expiryPlaceholder")

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{i18n.t("admin.users.detail.ban.reasonLabel")}</span>
        <span className="text-sm">{reason}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{i18n.t("admin.users.detail.expires")}</span>
        <span className="text-sm">{expires}</span>
      </div>
    </div>
  )
}

interface ExpiryPickerProps {
  readonly expires: Date | undefined
  readonly onChange: (date: Date | undefined) => void
}

function ExpiryPicker({ expires, onChange }: ExpiryPickerProps) {
  const [open, setOpen] = useState(false)
  const dayPickerLocale = i18n.language === "id" ? idLocale : enUS

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
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
              onChange(date)
              setOpen(false)
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
          onChange(undefined)
        }}
      >
        {i18n.t("admin.users.detail.ban.clearExpiry")}
      </Button>
    </div>
  )
}

interface BanConfirmDialogProps {
  readonly open: boolean
  readonly banned: boolean
  readonly pending: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: () => void
}

function BanConfirmDialog({ open, banned, pending, onOpenChange, onConfirm }: BanConfirmDialogProps) {
  const title = banned
    ? i18n.t("admin.users.detail.confirm.unban.title")
    : i18n.t("admin.users.detail.confirm.ban.title")
  const description = banned
    ? i18n.t("admin.users.detail.confirm.unban.description")
    : i18n.t("admin.users.detail.confirm.ban.description")

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{i18n.t("admin.users.detail.confirm.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant={banActionVariant(banned)} disabled={pending} onClick={onConfirm}>
            {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
            {i18n.t("admin.users.detail.confirm.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface BanSectionProps {
  readonly user: UserWithRole
}

export function BanSection({ user }: BanSectionProps) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [expires, setExpires] = useState<Date | undefined>(undefined)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const banned = user.banned ?? false

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
      await invalidateUserQueries(queryClient, user.id)
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
    onSuccess: async () => {
      await invalidateUserQueries(queryClient, user.id)
    },
    onSettled: () => {
      setConfirmOpen(false)
    }
  })

  const pending = ban.isPending || unban.isPending
  const error = ban.error || unban.error

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.ban.title")}</CardTitle>
        <CardDescription>{i18n.t("admin.users.detail.ban.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {banned ? (
          <BanSummary user={user} />
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
              <ExpiryPicker expires={expires} onChange={setExpires} />
            </Field>
          </FieldGroup>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{i18n.t("admin.users.detail.ban.error.generic")}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          size="sm"
          variant={banActionVariant(banned)}
          className="self-start"
          disabled={pending}
          onClick={() => {
            setConfirmOpen(true)
          }}
        >
          {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
          {banActionLabel(banned, pending)}
        </Button>

        <BanConfirmDialog
          open={confirmOpen}
          banned={banned}
          pending={pending}
          onOpenChange={nextOpen => {
            if (!nextOpen) setConfirmOpen(false)
          }}
          onConfirm={() => {
            if (banned) {
              unban.mutate()
            } else {
              ban.mutate()
            }
          }}
        />
      </CardContent>
    </Card>
  )
}
