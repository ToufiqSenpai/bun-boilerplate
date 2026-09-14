import type { Role } from "@bun-boilerplate/backend/auth"
import { IconLayoutDashboard, IconSettings, IconUsers } from "@tabler/icons-react"
import { Link, notFound, Outlet, createFileRoute, redirect, useMatchRoute } from "@tanstack/react-router"
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
import { authClient } from "src/utils/client"

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

interface NavItem {
  title: string
  to?: string
  icon: typeof IconLayoutDashboard
  allowed: (role: Role) => boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  { title: "Dashboard", to: "/admin", icon: IconLayoutDashboard, allowed: () => true },
  {
    title: "Users",
    to: "/admin/users",
    icon: IconUsers,
    allowed: role => authClient.admin.checkRolePermission({ role, permissions: { user: ["list"] } })
  },
  { title: "Settings", icon: IconSettings, allowed: () => true }
]

function AdminRoute() {
  const { userSession } = Route.useRouteContext()
  const matchRoute = useMatchRoute()

  const navItems = NAV_ITEMS.filter(item => item.allowed(userSession.role))

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
                  const isActive = item.to !== undefined && matchRoute({ to: item.to, fuzzy: false }) !== false

                  return (
                    <SidebarMenuItem key={item.title}>
                      {item.to ? (
                        <SidebarMenuButton render={<Link to={item.to} />} isActive={isActive}>
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton>
                          <item.icon />
                          <span>{item.title}</span>
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
          <h1 className="text-sm font-medium">Dashboard</h1>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
