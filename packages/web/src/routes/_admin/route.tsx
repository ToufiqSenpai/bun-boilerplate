import type { Role } from "@bun-boilerplate/backend/auth"
import { Link, notFound, Outlet, createFileRoute, redirect } from "@tanstack/react-router"
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
import { AdminBreadcrumbs } from "src/routes/_admin/-layout/breadcrumbs"
import { AdminNav } from "src/routes/_admin/-layout/nav"
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

function AdminRoute() {
  const { userSession } = Route.useRouteContext()

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
              <AdminNav role={userSession.role} />
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
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background/40 px-4 backdrop-blur-2xl backdrop-saturate-200">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <AdminBreadcrumbs />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
