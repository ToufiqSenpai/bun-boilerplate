import { Outlet, createFileRoute } from "@tanstack/react-router"
import { AdminLayout } from "src/components/admin/layout"
import { Separator } from "src/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "src/components/ui/sidebar"

export const Route = createFileRoute("/_admin")({
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
