import { render, screen } from "@testing-library/react"

import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import { defineSetupFormCases } from "src/routes/admin/-components/setup-form-cases"
import { successSignUp } from "src/routes/admin/-components/setup-test-helpers"

test("renders header copy and localized labels", () => {
  render(<AdminSetupForm onSignUp={successSignUp()} />)

  expect(screen.getByText("Admin Setup")).toBeTruthy()
  expect(screen.getByText("Create the first administrator account to get started.")).toBeTruthy()
  expect(screen.getByLabelText("Name")).toBeTruthy()
  expect(screen.getByLabelText("Email")).toBeTruthy()
  expect(screen.getByLabelText("Password")).toBeTruthy()
  expect(screen.getByLabelText("Confirm password")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Create admin" })).toBeTruthy()
})

defineSetupFormCases("AdminSetupForm (en)", AdminSetupForm, {
  name: "Name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  title: "Admin Setup",
  submit: "Create admin",
  submitting: "Creating…",
  toggleShow: "Show password",
  toggleHide: "Hide password",
  nameRequired: "Name is required",
  nameMax: "Name must be at most 64 characters",
  emailInvalid: "Enter a valid email address",
  emailMax: "Email must be at most 128 characters",
  passwordMin: "Password must be at least 8 characters",
  passwordMax: "Password must be at most 128 characters",
  confirmRequired: "Confirm your password",
  mismatch: "Passwords do not match",
  serverGeneric: "Something went wrong. Please try again."
})
