import { fireEvent, render, screen } from "@testing-library/react"

import type { SetupSignUpInput } from "src/routes/admin/-components/setup-form"
import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import {
  VALID_SETUP_VALUES,
  fillValidSetupForm,
  touchSetupField
} from "src/routes/admin/-components/setup-test-helpers"

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
describe("AdminSetupForm (en)", () => {
  test("renders centered header copy and localized labels", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByText("Create the first administrator account to get started.")).toBeTruthy()
    expect(screen.getByLabelText("Name")).toBeTruthy()
    expect(screen.getByLabelText("Email")).toBeTruthy()
    expect(screen.getByLabelText("Password")).toBeTruthy()
    expect(screen.getByLabelText("Confirm password")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create admin" })).toBeTruthy()
  })

  test("shows inline required error for an empty name", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField("Name", "")

    expect(await screen.findByText("Name is required")).toBeTruthy()
  })

  test("shows inline max-length error for a long name", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField("Name", "a".repeat(65))

    expect(await screen.findByText("Name must be at most 64 characters")).toBeTruthy()
  })

  test("shows inline error for an invalid email", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField("Email", "not-an-email")

    expect(await screen.findByText("Enter a valid email address")).toBeTruthy()
  })

  test("shows inline max-length error for a long email", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField("Email", `${"a".repeat(120)}@example.com`)

    expect(await screen.findByText("Email must be at most 128 characters")).toBeTruthy()
  })

  test("shows inline error for a short password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField("Password", "short")

    expect(await screen.findByText("Password must be at least 8 characters")).toBeTruthy()
  })

  test("shows inline max-length error for a long password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField("Password", "a".repeat(129))

    expect(await screen.findByText("Password must be at most 128 characters")).toBeTruthy()
  })

  test("shows inline required error for an empty confirm password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField("Confirm password", "")

    expect(await screen.findByText("Confirm your password")).toBeTruthy()
  })

  test("shows inline mismatch error for confirm password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
    touchSetupField("Confirm password", "something-else")

    expect(await screen.findByText("Passwords do not match")).toBeTruthy()
  })

  test("toggles password visibility on both password fields", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    const toggles = screen.getAllByRole("button", { name: "Show password" })
    expect(toggles).toHaveLength(2)

    const passwordInput = screen.getByLabelText("Password")
    const confirmInput = screen.getByLabelText("Confirm password")

    expect(passwordInput.getAttribute("type")).toBe("password")

    for (const toggle of toggles) fireEvent.click(toggle)

    expect(passwordInput.getAttribute("type")).toBe("text")
    expect(confirmInput.getAttribute("type")).toBe("text")
    expect(screen.getAllByRole("button", { name: "Hide password" })).toHaveLength(2)
  })

  test("shows the raw server message in a destructive alert", async () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: { message: "Email already taken" } })} />)

    fillValidSetupForm(LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Create admin" }))

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Email already taken")
    expect(alert.getAttribute("data-slot")).toBe("alert")
  })

  test("shows the generic fallback when the server error has no message", async () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: {} })} />)

    fillValidSetupForm(LABELS)
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

    fillValidSetupForm(LABELS)
    const submit = screen.getByRole("button", { name: "Create admin" })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(await screen.findByText("Creating…")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Creating…" }).hasAttribute("disabled")).toBe(true)

    release()

    await screen.findByText("Create admin")
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ name: VALID_SETUP_VALUES.name, email: VALID_SETUP_VALUES.email, password: VALID_SETUP_VALUES.password })
    expect(completed).toEqual([VALID_SETUP_VALUES.email])
  })

  test("stays on the form after success instead of navigating away", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fillValidSetupForm(LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Create admin" }))

    await screen.findByText("Create admin")
    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByLabelText("Email")).toBeTruthy()
  })
})
