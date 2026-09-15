import { isKnownRole, type Role } from "@bun-boilerplate/backend/auth"
import { IconLoader2, IconUserOff } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery, type QueryStatus } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
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
import { Card, CardContent, CardHeader, CardTitle } from "src/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "src/components/ui/empty"
import { FieldGroup } from "src/components/ui/field"
import { FieldChrome, fieldValidator } from "src/components/ui/field-chrome"
import { Input } from "src/components/ui/input"
import { PasswordInput } from "src/components/ui/password-input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "src/components/ui/select"
import { Skeleton } from "src/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { i18n } from "src/i18n"
import { ROLE_OPTIONS } from "src/routes/_admin/-users/roles"
import { userNameSchema, userPasswordSchema } from "src/routes/_admin/-users/schemas"
import { BanBadge, VerificationBadge } from "src/routes/_admin/-users/status-badges"
import { authClient } from "src/utils/client"
import { formatDate } from "src/utils/date"

const sessionSkeletonKeys = [0, 1, 2] as const

const BROWSER_LABELS = [
  { pattern: /Edg\//, label: "Edge" },
  { pattern: /OPR\//, label: "Opera" },
  { pattern: /Chrome\//, label: "Chrome" },
  { pattern: /Firefox\//, label: "Firefox" },
  { pattern: /Safari\//, label: "Safari" }
] as const

const PLATFORM_LABELS = [
  { pattern: /Windows/, label: "Windows" },
  { pattern: /Android/, label: "Android" },
  { pattern: /iPhone|iPad/, label: "iOS" },
  { pattern: /Mac OS X/, label: "macOS" },
  { pattern: /Linux/, label: "Linux" }
] as const

function describeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null

  const browser = BROWSER_LABELS.find(entry => entry.pattern.test(userAgent))?.label
  const platform = PLATFORM_LABELS.find(entry => entry.pattern.test(userAgent))?.label

  if (browser && platform) return `${browser} · ${platform}`

  return browser ?? platform ?? null
}

function initials(user: UserWithRole): string {
  const source = user.name.trim() === "" ? user.email : user.name

  return source
    .split(" ")
    .filter(part => part !== "")
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("")
}

const userQuery = (userId: string) =>
  queryOptions({
    queryKey: ["user", userId],
    queryFn: async () => {
      const { data } = await authClient.admin.getUser({ query: { id: userId } })

      return data
    }
  })

const sessionsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["user-sessions", userId],
    queryFn: async () => {
      const { data } = await authClient.admin.listUserSessions({ userId })

      if (!data) throw new Error("Failed to load sessions")

      return data.sessions
    }
  })

export const Route = createFileRoute("/_admin/admin/users_/$userId")({
  head: () => ({
    meta: [{ title: "Admin User" }]
  }),
  beforeLoad: ({ context }) => {
    const role = context.userSession.role

    if (!authClient.admin.checkRolePermission({ role, permissions: { user: ["list"] } })) throw notFound()
  },
  loader: async ({ context, params }) => {
    const user = await context.queryClient.query(userQuery(params.userId))

    if (!user) throw notFound()

    return user
  },
  notFoundComponent: UserNotFound,
  component: UserDetailPage
})

function UserNotFound() {
  return (
    <div className="flex w-full flex-1 items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconUserOff />
          </EmptyMedia>
          <EmptyTitle>{i18n.t("admin.users.detail.notFound.title")}</EmptyTitle>
          <EmptyDescription>{i18n.t("admin.users.detail.notFound.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/admin/users" />} nativeButton={false} variant="outline" size="sm">
            {i18n.t("admin.users.detail.notFound.back")}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
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
          <AlertDialogCancel disabled={pending}>{i18n.t("admin.users.detail.confirm.cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
            {i18n.t("admin.users.detail.confirm.confirm")}
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
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  const form = useForm({
    defaultValues: { name: user.name },
    onSubmit: async ({ value }) => {
      const parsed = userNameSchema.safeParse(value.name)

      if (!parsed.success) return

      setPending(true)
      setServerError(false)
      setSaved(false)

      const ok = await onUpdateName(parsed.data)

      setPending(false)
      setServerError(!ok)
      setSaved(ok)

      if (ok) form.reset({ name: parsed.data })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.profile")}</CardTitle>
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
            <form.Field name="name" validators={{ onChange: fieldValidator(userNameSchema) }}>
              {field => (
                <FieldChrome
                  id="user-name"
                  label={i18n.t("admin.users.detail.nameLabel")}
                  touched={field.state.meta.isTouched}
                  messages={field.state.meta.errors.map(String)}
                >
                  <Input
                    id="user-name"
                    name={field.name}
                    autoComplete="name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={event => {
                      setSaved(false)
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

            {saved && <p className="text-sm text-muted-foreground">{i18n.t("admin.users.detail.saved")}</p>}

            <form.Subscribe selector={state => state.canSubmit && state.values.name.trim() !== user.name}>
              {canSave => (
                <Button type="submit" size="sm" className="self-start" disabled={!canSave || pending}>
                  {pending && <IconLoader2 className="animate-spin" aria-hidden="true" />}
                  {pending ? i18n.t("admin.users.detail.saving") : i18n.t("admin.users.detail.save")}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.role")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="user-role" aria-label={i18n.t("admin.users.detail.role")} className="w-full">
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
          {pending ? i18n.t("admin.users.detail.saving") : i18n.t("admin.users.detail.changeRole")}
        </Button>
        <ConfirmActionDialog
          open={confirmOpen}
          title={i18n.t("admin.users.detail.confirm.changeRole.title")}
          description={i18n.t("admin.users.detail.confirm.changeRole.description", { role: role ?? "" })}
          pending={pending}
          onCancel={() => {
            setConfirmOpen(false)
          }}
          onConfirm={() => {
            void confirm()
          }}
        />
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.password")}</CardTitle>
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
            <form.Field name="password" validators={{ onChange: fieldValidator(userPasswordSchema) }}>
              {field => (
                <FieldChrome
                  id="user-password"
                  label={i18n.t("admin.users.detail.newPassword")}
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
                  {pending ? i18n.t("admin.users.detail.saving") : i18n.t("admin.users.detail.resetPassword")}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
        <ConfirmActionDialog
          open={confirmOpen}
          title={i18n.t("admin.users.detail.confirm.setPassword.title")}
          description={i18n.t("admin.users.detail.confirm.setPassword.description")}
          pending={pending}
          onCancel={() => {
            setConfirmOpen(false)
          }}
          onConfirm={() => {
            void confirm()
          }}
        />
      </CardContent>
    </Card>
  )
}

interface SessionsSectionProps {
  readonly status: QueryStatus
  readonly sessions: readonly SessionWithImpersonatedBy[]
}

function SessionsSection({ status, sessions }: SessionsSectionProps) {
  let content
  if (status === "error") {
    content = (
      <Alert variant="destructive">
        <AlertDescription>{i18n.t("admin.users.error.generic")}</AlertDescription>
      </Alert>
    )
  } else if (status === "pending") {
    content = (
      <div className="flex flex-col gap-2">
        {sessionSkeletonKeys.map(key => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    )
  } else if (sessions.length === 0) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconLoader2 />
          </EmptyMedia>
          <EmptyTitle>{i18n.t("admin.users.detail.sessionsEmpty")}</EmptyTitle>
          <EmptyDescription>{i18n.t("admin.users.detail.unknownDevice")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t("admin.users.detail.device")}</TableHead>
            <TableHead className="hidden md:table-cell">{i18n.t("admin.users.detail.ip")}</TableHead>
            <TableHead>{i18n.t("admin.users.detail.expires")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map(session => (
            <TableRow key={session.id}>
              <TableCell className="max-w-64 truncate" title={session.userAgent ?? undefined}>
                {describeUserAgent(session.userAgent) ?? i18n.t("admin.users.detail.unknownDevice")}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{session.ipAddress ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(session.expiresAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t("admin.users.detail.sessions")}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

function UserDetailPage() {
  const { userId } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: user } = useSuspenseQuery(userQuery(userId))
  const sessions = useQuery(sessionsQuery(userId))

  const updateName = async (name: string): Promise<boolean> => {
    const { error } = await authClient.admin.updateUser({ userId, data: { name } })

    if (error) return false

    await queryClient.invalidateQueries({ queryKey: ["user", userId] })
    await queryClient.invalidateQueries({ queryKey: ["users"] })
    return true
  }

  const changeRole = async (role: Role): Promise<boolean> => {
    const { error } = await authClient.admin.setRole({ userId, role })

    if (error) return false

    await queryClient.invalidateQueries({ queryKey: ["user", userId] })
    await queryClient.invalidateQueries({ queryKey: ["users"] })
    return true
  }

  const setPassword = async (password: string): Promise<boolean> => {
    const { error } = await authClient.admin.setUserPassword({ userId, newPassword: password })

    if (error) return false

    await queryClient.invalidateQueries({ queryKey: ["users"] })
    return true
  }

  if (!user) return null

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-medium">
          {initials(user)}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg font-medium">{user.name}</span>
            <Badge variant="secondary" className="capitalize">
              {user.role ?? "—"}
            </Badge>
            <VerificationBadge verified={user.emailVerified} />
            <BanBadge banned={user.banned ?? false} />
          </div>
          <span className="truncate text-sm text-muted-foreground">{user.email}</span>
          <span className="text-xs text-muted-foreground">
            {i18n.t("admin.users.columns.created")} · {formatDate(user.createdAt)}
          </span>
        </div>
      </div>

      <ProfileSection user={user} onUpdateName={updateName} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RoleSection user={user} onChangeRole={changeRole} />
        <PasswordSection onSetPassword={setPassword} />
      </div>

      <SessionsSection status={sessions.status} sessions={sessions.data ?? []} />
    </div>
  )
}
