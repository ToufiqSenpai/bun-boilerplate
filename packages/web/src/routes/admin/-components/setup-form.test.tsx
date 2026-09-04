import { fireEvent, render, screen } from "@testing-library/react"
import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import type { SetupSignUpInput } from "src/routes/admin/-components/setup-form"

const VALID = {
  name: "Admin",
  email: "admin@example.com",
  password: "password123",
  confirmPassword: "password123"
} as const

const LABELS = {
  name: "Name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password"
} as const

function successSignUp(calls: SetupSignUpInput[] = []) {
  return async (input: SetupSignUpInput) => {
    calls.push(input)
    return { error: null }
  }
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(LABELS.name), { target: { value: VALID.name } })
  fireEvent.change(screen.getByLabelText(LABELS.email), { target: { value: VALID.email } })
  fireEvent.change(screen.getByLabelText(LABELS.password), { target: { value: VALID.password } })
  fireEvent.change(screen.getByLabelText(LABELS.confirmPassword), { target: { value: VALID.confirmPassword } })
}

function touchField(label: string, value: string) {
  const input = screen.getByLabelText(label)
  // Type then set the target value: TanStack skips validation when the value is unchanged.
  fireEvent.change(input, { target: { value: `${value}x` } })
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe("AdminSetupForm", () => {
  test("renders header copy and localized labels", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByText("Create the first administrator account to get started.")).toBeTruthy()
    expect(screen.getByLabelText(LABELS.name)).toBeTruthy()
    expect(screen.getByLabelText(LABELS.email)).toBeTruthy()
    expect(screen.getByLabelText(LABELS.password)).toBeTruthy()
    expect(screen.getByLabelText(LABELS.confirmPassword)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create admin" })).toBeTruthy()
  })

  test.each([
    { label: "Name", value: "", expected: "Name is required" },
    { label: "Name", value: "a".repeat(65), expected: "Name must be at most 64 characters" },
    { label: "Email", value: "not-an-email", expected: "Enter a valid email address" },
    { label: "Email", value: `${"a".repeat(120)}@example.com`, expected: "Email must be at most 128 characters" },
    { label: "Password", value: "short", expected: "Password must be at least 8 characters" },
    { label: "Password", value: "a".repeat(129), expected: "Password must be at most 128 characters" },
    { label: "Confirm password", value: "", expected: "Confirm your password" }
  ])("shows inline error: $expected", async ({ label, value, expected }) => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchField(label, value)

    expect(await screen.findByText(expected)).toBeTruthy()
  })

  test("shows inline mismatch error for confirm password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fireEvent.change(screen.getByLabelText(LABELS.password), { target: { value: "password123" } })
    touchField(LABELS.confirmPassword, "something-else")

    expect(await screen.findByText("Passwords do not match")).toBeTruthy()
  })

  test("toggles password visibility on both password fields", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    const toggles = screen.getAllByRole("button", { name: "Show password" })
    expect(toggles).toHaveLength(2)

    const passwordInput = screen.getByLabelText(LABELS.password)
    const confirmInput = screen.getByLabelText(LABELS.confirmPassword)

    expect(passwordInput.getAttribute("type")).toBe("password")
    expect(passwordInput.getAttribute("autocomplete")).toBe("new-password")
    expect(confirmInput.getAttribute("autocomplete")).toBe("new-password")

    for (const toggle of toggles) fireEvent.click(toggle)

    expect(passwordInput.getAttribute("type")).toBe("text")
    expect(confirmInput.getAttribute("type")).toBe("text")
    expect(screen.getAllByRole("button", { name: "Hide password" })).toHaveLength(2)
  })

  test("shows the raw server message in a destructive alert", async () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: { message: "Email already taken" } })} />)

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Create admin" }))

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Email already taken")
    expect(alert.dataset.slot).toBe("alert")
  })

  test("shows the generic fallback when the server error has no message", async () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: {} })} />)

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Create admin" }))

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy()
  })

  test("disables the button with a loading state and submits once", async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const calls: SetupSignUpInput[] = []
    const completed: string[] = []

    render(
      <AdminSetupForm
        onSignUp={async input => {
          calls.push(input)
          await gate
          return { error: null }
        }}
        onSetupComplete={email => {
          completed.push(email)
        }}
      />
    )

    fillValidForm()
    const submit = screen.getByRole("button", { name: "Create admin" })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(await screen.findByText("Creating…")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Creating…" }).hasAttribute("disabled")).toBe(true)

    release()

    await screen.findByText("Create admin")
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ name: VALID.name, email: VALID.email, password: VALID.password })
    expect(completed).toEqual([VALID.email])
  })

  test("stays on the form after success instead of navigating away", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Create admin" }))

    await screen.findByText("Create admin")
    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByLabelText(LABELS.email)).toBeTruthy()
  })
})
