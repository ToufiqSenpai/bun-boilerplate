import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "src/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "src/components/ui/card"

const placeholderStats = [
  { title: "Total Users", description: "Registered accounts", value: "—" },
  { title: "Active Sessions", description: "Signed in right now", value: "—" },
  { title: "Revenue", description: "This month", value: "—" }
] as const

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({
    meta: [{ title: "Admin Dashboard" }]
  }),
  component: AdminDashboardPage
})

function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">Overview of your application.</p>
        <Badge variant="secondary">Placeholder</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {placeholderStats.map(stat => (
          <Card key={stat.title}>
            <CardHeader>
              <CardTitle>{stat.title}</CardTitle>
              <CardDescription>{stat.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-muted-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
