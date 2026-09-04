import { fireEvent, render, screen } from "@testing-library/react"

import { AdminLoginForm, type SignInInput } from "src/routes/admin/-components/login-form"

const LABELS = {
  email: "Email",
  password: "Password"
} as const

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(LABELS.email), { target: { value: "admin@example.com" } })
  fireEvent.change(screen.getByLabelText(LABELS.password), { target: { value: "password123" } })
}

function touchField(label: string, value: string) {
  const input = screen.getByLabelText(label)
  // Type then set the target value: TanStack skips validation when the value is unchanged.
  fireEvent.change(input, { target: { value: `${value}x` } })
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe("AdminLoginForm", () => {
  test("renders header copy and localized labels", () => {
    render(<AdminLoginForm onSignIn={async () => ({ error: null })} />)

    expect(screen.getByText("Admin Login")).toBeTruthy()
    expect(screen.getByText("Sign in to access the admin dashboard.")).toBeTruthy()
    expect(screen.getByLabelText(LABELS.email)).toBeTruthy()
    expect(screen.getByLabelText(LABELS.password)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy()
  })

  test.each([
    { label: LABELS.email, value: "not-an-email", expected: "Enter a valid email address" },
    { label: LABELS.password, value: "", expected: "Password is required" }
  ])("shows inline validation error: $expected", async ({ label, value, expected }) => {
    render(<AdminLoginForm onSignIn={async () => ({ error: null })} />)

    touchField(label, value)

    expect(await screen.findByText(expected)).toBeTruthy()
  })

  test("toggles password visibility with an accessible mask button", () => {
    render(<AdminLoginForm onSignIn={async () => ({ error: null })} />)

    const passwordInput = screen.getByLabelText(LABELS.password)
    expect(passwordInput.getAttribute("type")).toBe("password")
    expect(passwordInput.getAttribute("autocomplete")).toBe("current-password")

    fireEvent.click(screen.getByRole("button", { name: "Show password" }))

    expect(passwordInput.getAttribute("type")).toBe("text")
    expect(screen.getByRole("button", { name: "Hide password" })).toBeTruthy()
  })

  test("shows a single generic destructive alert on any sign-in failure", async () => {
    render(<AdminLoginForm onSignIn={async () => ({ error: { message: "User not found" } })} />)

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Email or password is incorrect")
    expect(alert.dataset.slot).toBe("alert")
    expect(screen.queryByText("User not found")).toBeNull()
  })

  test("sends the entered credentials to the sign-in seam exactly once", async () => {
    const calls: SignInInput[] = []
    render(
      <AdminLoginForm
        onSignIn={async input => {
          calls.push(input)
          return { error: null }
        }}
      />
    )

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await screen.findByRole("button", { name: "Sign in" })
    expect(calls).toEqual([{ email: "admin@example.com", password: "password123" }])
  })

  test("disables the button with a loading state while signing in", async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    render(
      <AdminLoginForm
        onSignIn={async () => {
          await gate
          return { error: null }
        }}
      />
    )

    fillValidForm()
    const submit = screen.getByRole("button", { name: "Sign in" })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(await screen.findByText("Signing in…")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Signing in…" }).hasAttribute("disabled")).toBe(true)

    release()

    await screen.findByText("Sign in")
  })
})
