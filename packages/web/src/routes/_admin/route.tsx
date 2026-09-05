import { notFound, Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { AdminLayout } from "src/components/admin/layout"
import { Separator } from "src/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "src/components/ui/sidebar"
import { resolveAdminAccess } from "src/routes/admin/-lib/access"
import { readAdminSession } from "src/routes/admin/-lib/session-reader"
import { api } from "src/utils/client"

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ location }) => {
    const setup = await api.auth.setup.get()
    const session = await readAdminSession()

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

function AdminRoute() {
  return (
    <SidebarProvider>
      <AdminLayout />
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
