import { IconLayoutDashboard, IconSettings, IconUsers } from "@tabler/icons-react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "src/components/ui/sidebar"

interface NavItem {
  title: string
  to?: "/admin" | "/admin/users"
  icon: typeof IconLayoutDashboard
}

export interface AdminLayoutProps {
  readonly role: string | null
}

export function AdminLayout({ role }: AdminLayoutProps) {
  const matchRoute = useMatchRoute()
  const isUsersSuperadmin = role === "superadmin"

  const navItems: NavItem[] = [
    { title: "Dashboard", to: "/admin", icon: IconLayoutDashboard },
    ...(isUsersSuperadmin ? [{ title: "Users", to: "/admin/users" as const, icon: IconUsers }] : []),
    { title: "Settings", icon: IconSettings }
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/admin" />}>
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
  )
}
