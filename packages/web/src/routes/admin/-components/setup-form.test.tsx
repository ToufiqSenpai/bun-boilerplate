import { AdminSetupForm } from "src/routes/admin/-components/setup-form"
import { defineSetupFormCases } from "src/routes/admin/-components/setup-form-cases"

defineSetupFormCases("AdminSetupForm (en)", AdminSetupForm, {
  name: "Name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  title: "Admin Setup",
  description: "Create the first administrator account to get started.",
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
