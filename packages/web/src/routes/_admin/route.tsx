import type { Role } from "@bun-boilerplate/backend/auth"
import { IconLayoutDashboard, IconSettings, IconUsers } from "@tabler/icons-react"
import { Link, notFound, Outlet, createFileRoute, redirect, useLocation, useMatches } from "@tanstack/react-router"
import { Fragment } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "src/components/ui/breadcrumb"
import { Separator } from "src/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "src/components/ui/sidebar"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"
import { z } from "zod"

const ALLOWED_ROLES: readonly Role[] = ["superadmin", "admin"]

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession()
    const user = data?.user

    if (!user) throw redirect({ to: "/admin/login", search: { redirect: location.href } })

    const role = ALLOWED_ROLES.find(adminRole => adminRole === user.role)

    if (!role) throw notFound()

    return { userSession: { email: user.email, role } }
  },
  component: AdminRoute
})

type NavKey = "admin.nav.dashboard" | "admin.nav.settings" | "admin.nav.users"

interface NavItem {
  titleKey: NavKey
  to?: string
  icon: typeof IconLayoutDashboard
  allowed: (role: Role) => boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  { titleKey: "admin.nav.dashboard", to: "/admin", icon: IconLayoutDashboard, allowed: () => true },
  {
    titleKey: "admin.nav.users",
    to: "/admin/users",
    icon: IconUsers,
    allowed: role => authClient.admin.checkRolePermission({ role, permissions: { user: ["list"] } })
  },
  { titleKey: "admin.nav.settings", icon: IconSettings, allowed: () => true }
]

interface CrumbItem {
  path: "/admin" | "/admin/users" | "/admin/users/create"
  labelKey: NavKey | "admin.users.create.title"
}

const ROOT_CRUMB: CrumbItem = { path: "/admin", labelKey: "admin.nav.dashboard" }

const CRUMB_ITEMS: readonly CrumbItem[] = [
  ROOT_CRUMB,
  { path: "/admin/users", labelKey: "admin.nav.users" },
  { path: "/admin/users/create", labelKey: "admin.users.create.title" }
]

const userCrumbSchema = z.object({ name: z.string() })

const DETAIL_ROUTE_ID = "/_admin/admin/users_/$userId"

interface RenderedCrumb {
  key: string
  label: string
  to?: CrumbItem["path"]
}

function AdminRoute() {
  const { userSession } = Route.useRouteContext()
  const { pathname } = useLocation()
  const matches = useMatches()

  const navItems = NAV_ITEMS.filter(item => item.allowed(userSession.role))
  const activeItem = navItems
    .filter(item => item.to !== undefined && (pathname === item.to || pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => (b.to?.length ?? 0) - (a.to?.length ?? 0))[0]

  const detailMatch = matches.find(match => match.routeId === DETAIL_ROUTE_ID)
  const detailUser = detailMatch ? userCrumbSchema.safeParse(detailMatch.loaderData) : undefined
  const crumbs: readonly RenderedCrumb[] = [
    ...CRUMB_ITEMS.filter(crumb => pathname === crumb.path || pathname.startsWith(`${crumb.path}/`)).map(crumb => ({
      key: crumb.path,
      label: i18n.t(crumb.labelKey),
      to: crumb.path
    })),
    ...(detailMatch
      ? [
          {
            key: pathname,
            label: detailUser?.success ? detailUser.data.name : i18n.t("admin.users.detail.crumb")
          }
        ]
      : [])
  ]
  const currentCrumb = crumbs.at(-1) ?? { key: ROOT_CRUMB.path, label: i18n.t(ROOT_CRUMB.labelKey) }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link to="/admin" />}>
                <span className="text-base font-semibold">Admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(item => {
                  return (
                    <SidebarMenuItem key={item.titleKey}>
                      {item.to ? (
                        <SidebarMenuButton render={<Link to={item.to} />} isActive={item.to === activeItem?.to}>
                          <item.icon />
                          <span>{i18n.t(item.titleKey)}</span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton>
                          <item.icon />
                          <span>{i18n.t(item.titleKey)}</span>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <span className="text-sm">{userSession.email}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <h1 className="sr-only">{currentCrumb.label}</h1>
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, index) => {
                const isCurrent = index === crumbs.length - 1

                return (
                  <Fragment key={crumb.key}>
                    <BreadcrumbItem>
                      {isCurrent || !crumb.to ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isCurrent && <BreadcrumbSeparator />}
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
