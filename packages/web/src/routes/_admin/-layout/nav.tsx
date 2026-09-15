import type { Role } from "@bun-boilerplate/backend/auth"
import { IconLayoutDashboard, IconSettings, IconUsers, type TablerIcon } from "@tabler/icons-react"
import { Link, useLocation } from "@tanstack/react-router"
import type { ParseKeys } from "i18next"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "src/components/ui/sidebar"
import { i18n } from "src/i18n"
import { authClient } from "src/utils/client"

interface NavItem {
  titleKey: ParseKeys
  to: string
  icon: TablerIcon
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
  { titleKey: "admin.nav.settings", to: "/admin/settings", icon: IconSettings, allowed: () => true }
]

export function AdminNav({ role }: { readonly role: Role }) {
  const { pathname } = useLocation()

  const navItems = NAV_ITEMS.filter(item => item.allowed(role))
  const activeItem = navItems
    .filter(item => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]

  return (
    <SidebarMenu>
      {navItems.map(item => {
        return (
          <SidebarMenuItem key={item.titleKey}>
            <SidebarMenuButton render={<Link to={item.to} />} isActive={item.to === activeItem?.to}>
              <item.icon />
              <span>{i18n.t(item.titleKey)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
