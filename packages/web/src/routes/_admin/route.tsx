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
import { resolveAdminAccess } from "src/routes/admin/-lib/access"
import { readAdminSession } from "src/routes/admin/-lib/session-reader"
import { api } from "src/utils/client"

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context, location }) => {
    const setup = await api.auth.setup.get()
    const session = await readAdminSession()

    context.adminSetup = setup
    context.adminSession = session

    const access = resolveAdminAccess(setup, session)

    if (access === "setup-needed") throw redirect({ to: "/admin/setup" })
    if (access === "sign-in") throw redirect({ to: "/admin/login", search: { redirect: location.href } })

    if (access === "verification-pending") {
      const email = session.data?.user.email

      if (email === undefined) throw redirect({ to: "/admin/setup" })

      throw redirect({ to: "/admin/setup", search: { email } })
    }

    if (access === "forbidden") throw notFound()
  },
  component: AdminRoute
})

interface NavItem {
  title: string
  to?: "/admin" | "/admin/users"
  icon: typeof IconLayoutDashboard
}

function AdminRoute() {
  const { adminSetup, adminSession } = Route.useRouteContext()
  const matchRoute = useMatchRoute()

  const canManageUsers =
    adminSetup !== null && adminSession !== null && resolveAdminAccess(adminSetup, adminSession, "users") === "allowed"

  const navItems: NavItem[] = [
    { title: "Dashboard", to: "/admin", icon: IconLayoutDashboard },
    ...(canManageUsers ? [{ title: "Users", to: "/admin/users" as const, icon: IconUsers }] : []),
    { title: "Settings", icon: IconSettings }
  ]

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
                <span className="text-sm">admin@example.com</span>
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
