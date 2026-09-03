import { fireEvent, render, screen } from "@testing-library/react"

import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import type { SetupSignUpInput } from "src/routes/admin/-components/setup-form"
import {
  EN_FIELD_LABELS,
  EN_VALIDATION_CASES,
  VALID_SETUP_VALUES,
  fillValidSetupForm,
  successSignUp,
  touchSetupField
} from "src/routes/admin/-components/setup-test-helpers"

describe("AdminSetupForm (en)", () => {
  test("renders header copy and localized labels", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByText("Create the first administrator account to get started.")).toBeTruthy()
    expect(screen.getByLabelText(EN_FIELD_LABELS.name)).toBeTruthy()
    expect(screen.getByLabelText(EN_FIELD_LABELS.email)).toBeTruthy()
    expect(screen.getByLabelText(EN_FIELD_LABELS.password)).toBeTruthy()
    expect(screen.getByLabelText(EN_FIELD_LABELS.confirmPassword)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create admin" })).toBeTruthy()
  })

  test.each(EN_VALIDATION_CASES)("shows inline error: $expected", async ({ label, value, expected }) => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField(label, value)

    expect(await screen.findByText(expected)).toBeTruthy()
  })

  test("shows inline mismatch error for confirm password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fireEvent.change(screen.getByLabelText(EN_FIELD_LABELS.password), { target: { value: "password123" } })
    touchSetupField(EN_FIELD_LABELS.confirmPassword, "something-else")

    expect(await screen.findByText("Passwords do not match")).toBeTruthy()
  })

  test("toggles password visibility on both password fields", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    const toggles = screen.getAllByRole("button", { name: "Show password" })
    expect(toggles).toHaveLength(2)

    const passwordInput = screen.getByLabelText(EN_FIELD_LABELS.password)
    const confirmInput = screen.getByLabelText(EN_FIELD_LABELS.confirmPassword)

    expect(passwordInput.getAttribute("type")).toBe("password")

    for (const toggle of toggles) fireEvent.click(toggle)

    expect(passwordInput.getAttribute("type")).toBe("text")
    expect(confirmInput.getAttribute("type")).toBe("text")
    expect(screen.getAllByRole("button", { name: "Hide password" })).toHaveLength(2)
  })

  test("shows the raw server message in a destructive alert", async () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: { message: "Email already taken" } })} />)

    fillValidSetupForm(EN_FIELD_LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Create admin" }))

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Email already taken")
    expect(alert.dataset.slot).toBe("alert")
  })

  test("shows the generic fallback when the server error has no message", async () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: {} })} />)

    fillValidSetupForm(EN_FIELD_LABELS)
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

    fillValidSetupForm(EN_FIELD_LABELS)
    const submit = screen.getByRole("button", { name: "Create admin" })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(await screen.findByText("Creating…")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Creating…" }).hasAttribute("disabled")).toBe(true)

    release()

    await screen.findByText("Create admin")
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      name: VALID_SETUP_VALUES.name,
      email: VALID_SETUP_VALUES.email,
      password: VALID_SETUP_VALUES.password
    })
    expect(completed).toEqual([VALID_SETUP_VALUES.email])
  })

  test("stays on the form after success instead of navigating away", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fillValidSetupForm(EN_FIELD_LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Create admin" }))

    await screen.findByText("Create admin")
    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByLabelText(EN_FIELD_LABELS.email)).toBeTruthy()
  })
})
