import { fireEvent, render, screen } from "@testing-library/react"

import type { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import type { SetupSignUpInput } from "src/routes/admin/-components/setup-form"
import type { SetupFieldLabels } from "src/routes/admin/-components/setup-test-helpers"
import {
  VALID_SETUP_VALUES,
  fillValidSetupForm,
  successSignUp,
  touchSetupField
} from "src/routes/admin/-components/setup-test-helpers"

interface SetupFormCaseTexts extends SetupFieldLabels {
  readonly title: string
  readonly description: string
  readonly submit: string
  readonly submitting: string
  readonly toggleShow: string
  readonly toggleHide: string
  readonly nameRequired: string
  readonly nameMax: string
  readonly emailInvalid: string
  readonly emailMax: string
  readonly passwordMin: string
  readonly passwordMax: string
  readonly confirmRequired: string
  readonly mismatch: string
  readonly serverGeneric: string
}

function defineSetupFormCases(suiteName: string, Form: typeof AdminSetupForm, text: SetupFormCaseTexts): void {
  describe(suiteName, () => {
    test("renders header copy and localized labels", () => {
      render(<Form onSignUp={successSignUp()} />)

      expect(screen.getByText(text.title)).toBeTruthy()
      expect(screen.getByText(text.description)).toBeTruthy()
      expect(screen.getByLabelText(text.name)).toBeTruthy()
      expect(screen.getByLabelText(text.email)).toBeTruthy()
      expect(screen.getByLabelText(text.password)).toBeTruthy()
      expect(screen.getByLabelText(text.confirmPassword)).toBeTruthy()
      expect(screen.getByRole("button", { name: text.submit })).toBeTruthy()
    })

    test("shows inline required error for an empty name", async () => {
      render(<Form onSignUp={successSignUp()} />)

      touchSetupField(text.name, "")

      expect(await screen.findByText(text.nameRequired)).toBeTruthy()
    })

    test("shows inline max-length error for a long name", async () => {
      render(<Form onSignUp={successSignUp()} />)

      touchSetupField(text.name, "a".repeat(65))

      expect(await screen.findByText(text.nameMax)).toBeTruthy()
    })

    test("shows inline error for an invalid email", async () => {
      render(<Form onSignUp={successSignUp()} />)

      touchSetupField(text.email, "not-an-email")

      expect(await screen.findByText(text.emailInvalid)).toBeTruthy()
    })

    test("shows inline max-length error for a long email", async () => {
      render(<Form onSignUp={successSignUp()} />)

      touchSetupField(text.email, `${"a".repeat(120)}@example.com`)

      expect(await screen.findByText(text.emailMax)).toBeTruthy()
    })

    test("shows inline error for a short password", async () => {
      render(<Form onSignUp={successSignUp()} />)

      touchSetupField(text.password, "short")

      expect(await screen.findByText(text.passwordMin)).toBeTruthy()
    })

    test("shows inline max-length error for a long password", async () => {
      render(<Form onSignUp={successSignUp()} />)

      touchSetupField(text.password, "a".repeat(129))

      expect(await screen.findByText(text.passwordMax)).toBeTruthy()
    })

    test("shows inline required error for an empty confirm password", async () => {
      render(<Form onSignUp={successSignUp()} />)

      touchSetupField(text.confirmPassword, "")

      expect(await screen.findByText(text.confirmRequired)).toBeTruthy()
    })

    test("shows inline mismatch error for confirm password", async () => {
      render(<Form onSignUp={successSignUp()} />)

      fireEvent.change(screen.getByLabelText(text.password), { target: { value: "password123" } })
      touchSetupField(text.confirmPassword, "something-else")

      expect(await screen.findByText(text.mismatch)).toBeTruthy()
    })

    test("toggles password visibility on both password fields", () => {
      render(<Form onSignUp={successSignUp()} />)

      const toggles = screen.getAllByRole("button", { name: text.toggleShow })
      expect(toggles).toHaveLength(2)

      const passwordInput = screen.getByLabelText(text.password)
      const confirmInput = screen.getByLabelText(text.confirmPassword)

      expect(passwordInput.getAttribute("type")).toBe("password")

      for (const toggle of toggles) fireEvent.click(toggle)

      expect(passwordInput.getAttribute("type")).toBe("text")
      expect(confirmInput.getAttribute("type")).toBe("text")
      expect(screen.getAllByRole("button", { name: text.toggleHide })).toHaveLength(2)
    })

    test("shows the raw server message in a destructive alert", async () => {
      render(<Form onSignUp={async () => ({ error: { message: "Email already taken" } })} />)

      fillValidSetupForm(text)
      fireEvent.click(screen.getByRole("button", { name: text.submit }))

      const alert = await screen.findByRole("alert")
      expect(alert.textContent).toContain("Email already taken")
      expect(alert.getAttribute("data-slot")).toBe("alert")
    })

    test("shows the generic fallback when the server error has no message", async () => {
      render(<Form onSignUp={async () => ({ error: {} })} />)

      fillValidSetupForm(text)
      fireEvent.click(screen.getByRole("button", { name: text.submit }))

      expect(await screen.findByText(text.serverGeneric)).toBeTruthy()
    })

    test("disables the button with a loading state and submits once", async () => {
      let release!: () => void
      const gate = new Promise<void>(resolve => {
        release = resolve
      })
      const calls: SetupSignUpInput[] = []
      const completed: string[] = []

      render(
        <Form
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

      fillValidSetupForm(text)
      const submit = screen.getByRole("button", { name: text.submit })
      fireEvent.click(submit)
      fireEvent.click(submit)

      expect(await screen.findByText(text.submitting)).toBeTruthy()
      expect(screen.getByRole("button", { name: text.submitting }).hasAttribute("disabled")).toBe(true)

      release()

      await screen.findByText(text.submit)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual({
        name: VALID_SETUP_VALUES.name,
        email: VALID_SETUP_VALUES.email,
        password: VALID_SETUP_VALUES.password
      })
      expect(completed).toEqual([VALID_SETUP_VALUES.email])
    })

    test("stays on the form after success instead of navigating away", async () => {
      render(<Form onSignUp={successSignUp()} />)

      fillValidSetupForm(text)
      fireEvent.click(screen.getByRole("button", { name: text.submit }))

      await screen.findByText(text.submit)
      expect(screen.getByText(text.title)).toBeTruthy()
      expect(screen.getByLabelText(text.email)).toBeTruthy()
    })
  })
}

export { defineSetupFormCases }
export type { SetupFormCaseTexts }
