import { isKnownRole, type Role } from "@bun-boilerplate/backend/auth"
import { IconLoader2 } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import type { QueryStatus } from "@tanstack/react-query"
import type { SessionWithImpersonatedBy, UserWithRole } from "better-auth/plugins/admin"
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
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import { FieldGroup } from "src/components/ui/field"
import { FieldChrome, fieldValidator } from "src/components/ui/field-chrome"
import { Input } from "src/components/ui/input"
import { PasswordInput } from "src/components/ui/password-input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "src/components/ui/select"
import { Separator } from "src/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "src/components/ui/sheet"
import { Skeleton } from "src/components/ui/skeleton"
import { i18n } from "src/i18n"
import { ROLE_OPTIONS } from "src/routes/_admin/-users/roles"
import { userNameSchema, userPasswordSchema } from "src/routes/_admin/-users/schemas"
import { BanBadge, VerificationBadge } from "src/routes/_admin/-users/status-badges"

export interface UserDetailDrawerProps {
  readonly user: UserWithRole | null
  readonly status: QueryStatus
  readonly sessions: readonly SessionWithImpersonatedBy[]
  readonly onClose: () => void
  readonly onUpdateName: (name: string) => Promise<boolean>
  readonly onChangeRole: (role: Role) => Promise<boolean>
  readonly onSetPassword: (password: string) => Promise<boolean>
}

const sessionSkeletonKeys = [0, 1, 2] as const

function SessionsSection({
  status,
  sessions
}: {
  readonly status: QueryStatus
  readonly sessions: readonly SessionWithImpersonatedBy[]
}) {
  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
      </Alert>
    )
  }

  if (status === "pending") {
    return (
      <div className="flex flex-col gap-2">
        {sessionSkeletonKeys.map(key => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{i18n.t("admin.users.drawer.sessionsEmpty")}</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map(session => (
        <li key={session.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>{session.userAgent ?? i18n.t("admin.users.drawer.unknownDevice")}</span>
            <span className="text-muted-foreground">{session.ipAddress ?? "—"}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {i18n.t("admin.users.drawer.expires")} {new Date(session.expiresAt).toISOString().slice(0, 10)}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface ConfirmActionDialogProps {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly pending: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function ConfirmActionDialog({ open, title, description, pending, onCancel, onConfirm }: ConfirmActionDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{i18n.t("admin.users.drawer.confirm.cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
            {i18n.t("admin.users.drawer.confirm.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface ProfileSectionProps {
  readonly user: UserWithRole
  readonly onUpdateName: (name: string) => Promise<boolean>
}

function ProfileSection({ user, onUpdateName }: ProfileSectionProps) {
  const [serverError, setServerError] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const form = useForm({
    defaultValues: { name: user.name },
    onSubmit: ({ value }) => {
      if (!userNameSchema.safeParse(value.name).success) return
      setConfirmOpen(true)
    }
  })

  const confirm = async () => {
    const parsed = userNameSchema.safeParse(form.state.values.name)

    if (!parsed.success) return

    setPending(true)
    const ok = await onUpdateName(parsed.data)
    setPending(false)
    setConfirmOpen(false)
    setServerError(!ok)
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium">{i18n.t("admin.users.drawer.profile")}</h3>
      <form
        onSubmit={event => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="name" validators={{ onChange: fieldValidator(userNameSchema) }}>
            {field => (
              <FieldChrome
                id="user-name"
                label={i18n.t("admin.users.drawer.nameLabel")}
                touched={field.state.meta.isTouched}
                messages={field.state.meta.errors.map(String)}
              >
                <Input
                  id="user-name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={event => {
                    field.handleChange(event.target.value)
                  }}
                />
              </FieldChrome>
            )}
          </form.Field>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
            </Alert>
          )}

          <form.Subscribe selector={state => state.canSubmit}>
            {canSubmit => (
              <Button type="submit" size="sm" className="self-start" disabled={!canSubmit || pending}>
                {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {pending ? i18n.t("admin.users.drawer.saving") : i18n.t("admin.users.drawer.save")}
              </Button>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
      <ConfirmActionDialog
        open={confirmOpen}
        title={i18n.t("admin.users.drawer.confirm.updateName.title")}
        description={i18n.t("admin.users.drawer.confirm.updateName.description", {
          newName: form.state.values.name.trim()
        })}
        pending={pending}
        onCancel={() => {
          setConfirmOpen(false)
        }}
        onConfirm={() => {
          void confirm()
        }}
      />
    </div>
  )
}

interface RoleSectionProps {
  readonly user: UserWithRole
  readonly onChangeRole: (role: Role) => Promise<boolean>
}

function RoleSection({ user, onChangeRole }: RoleSectionProps) {
  const [role, setRole] = useState<Role | null>(() => {
    const current = user.role

    if (!current) return null

    return isKnownRole(current) ? current : null
  })
  const [serverError, setServerError] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    if (!role) return

    setPending(true)
    const ok = await onChangeRole(role)
    setPending(false)
    setConfirmOpen(false)
    setServerError(!ok)
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium">{i18n.t("admin.users.drawer.role")}</h3>
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger id="user-role" aria-label={i18n.t("admin.users.drawer.role")} className="w-full">
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

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        size="sm"
        className="self-start"
        disabled={!role || pending}
        onClick={() => {
          setConfirmOpen(true)
        }}
      >
        {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
        {pending ? i18n.t("admin.users.drawer.saving") : i18n.t("admin.users.drawer.changeRole")}
      </Button>
      <ConfirmActionDialog
        open={confirmOpen}
        title={i18n.t("admin.users.drawer.confirm.changeRole.title")}
        description={i18n.t("admin.users.drawer.confirm.changeRole.description", { role: role ?? "" })}
        pending={pending}
        onCancel={() => {
          setConfirmOpen(false)
        }}
        onConfirm={() => {
          void confirm()
        }}
      />
    </div>
  )
}

interface PasswordSectionProps {
  readonly onSetPassword: (password: string) => Promise<boolean>
}

function PasswordSection({ onSetPassword }: PasswordSectionProps) {
  const [serverError, setServerError] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const form = useForm({
    defaultValues: { password: "" },
    onSubmit: ({ value }) => {
      if (!userPasswordSchema.safeParse(value.password).success) return
      setConfirmOpen(true)
    }
  })

  const confirm = async () => {
    const parsed = userPasswordSchema.safeParse(form.state.values.password)

    if (!parsed.success) return

    setPending(true)
    const ok = await onSetPassword(parsed.data)
    setPending(false)
    setConfirmOpen(false)
    setServerError(!ok)

    if (ok) form.reset()
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium">{i18n.t("admin.users.drawer.password")}</h3>
      <form
        onSubmit={event => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="password" validators={{ onChange: fieldValidator(userPasswordSchema) }}>
            {field => (
              <FieldChrome
                id="user-password"
                label={i18n.t("admin.users.drawer.newPassword")}
                touched={field.state.meta.isTouched}
                messages={field.state.meta.errors.map(String)}
              >
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
              </FieldChrome>
            )}
          </form.Field>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
            </Alert>
          )}

          <form.Subscribe selector={state => state.canSubmit}>
            {canSubmit => (
              <Button type="submit" size="sm" className="self-start" disabled={!canSubmit || pending}>
                {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                {pending ? i18n.t("admin.users.drawer.saving") : i18n.t("admin.users.drawer.resetPassword")}
              </Button>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
      <ConfirmActionDialog
        open={confirmOpen}
        title={i18n.t("admin.users.drawer.confirm.setPassword.title")}
        description={i18n.t("admin.users.drawer.confirm.setPassword.description")}
        pending={pending}
        onCancel={() => {
          setConfirmOpen(false)
        }}
        onConfirm={() => {
          void confirm()
        }}
      />
    </div>
  )
}

export function UserDetailDrawer({
  user,
  status,
  sessions,
  onClose,
  onUpdateName,
  onChangeRole,
  onSetPassword
}: UserDetailDrawerProps) {
  if (!user) return null

  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent showCloseButton={false} className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{user.name}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-6">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.role")}</span>
              <Badge variant="secondary">{user.role ?? "—"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.verification")}</span>
              <VerificationBadge verified={user.emailVerified} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.ban")}</span>
              <BanBadge banned={user.banned ?? false} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{i18n.t("admin.users.columns.created")}</span>
              <span>{new Date(user.createdAt).toISOString().slice(0, 10)}</span>
            </div>
          </div>
          <Separator />
          <ProfileSection user={user} onUpdateName={onUpdateName} />
          <Separator />
          <RoleSection user={user} onChangeRole={onChangeRole} />
          <Separator />
          <PasswordSection onSetPassword={onSetPassword} />
          <Separator />
          <div className="flex flex-col gap-2">
            <h3 className="font-heading text-sm font-medium">{i18n.t("admin.users.drawer.sessions")}</h3>
            <SessionsSection status={status} sessions={sessions} />
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              onClose()
            }}
          >
            {i18n.t("admin.users.drawer.close")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
