import { createFileRoute } from "@tanstack/react-router"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Admin Login" }]
  }),
  component: AdminLoginPage
})

function AdminLoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Sign in to access the admin dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" name="password" type="password" />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="button" className="w-full">
            Sign in
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
