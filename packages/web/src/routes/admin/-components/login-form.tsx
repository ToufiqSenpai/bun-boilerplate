import { useForm } from "@tanstack/react-form"
import { Button } from "src/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "src/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { i18n } from "src/i18n"

interface SignInInput {
  readonly email: string
  readonly password: string
}

interface SignInResult {
  readonly error: { readonly message?: string | undefined } | null
}

interface AdminLoginFormProps {
  readonly onSignIn: (input: SignInInput) => Promise<SignInResult>
}

function AdminLoginForm({ onSignIn }: AdminLoginFormProps) {
  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
    onSubmit: async () => {}
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">{i18n.t("admin.login.title")}</CardTitle>
          <CardDescription className="text-balance">{i18n.t("admin.login.description")}</CardDescription>
        </CardHeader>
        <form
          onSubmit={e => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{i18n.t("admin.login.email.label")}</FieldLabel>
                <Input id="email" name="email" type="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{i18n.t("admin.login.password.label")}</FieldLabel>
                <Input id="password" name="password" type="password" />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" className="w-full">
              {i18n.t("admin.login.submit")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}

export { AdminLoginForm }
export type { AdminLoginFormProps, SignInInput, SignInResult }
