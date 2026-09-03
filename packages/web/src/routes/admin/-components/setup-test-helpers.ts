import { fireEvent, screen } from "@testing-library/react"

import type { SetupSignUpInput } from "src/routes/admin/-components/setup-form"

interface SetupFieldLabels {
  readonly name: string
  readonly email: string
  readonly password: string
  readonly confirmPassword: string
}

interface ValidSetupValues {
  readonly name: string
  readonly email: string
  readonly password: string
  readonly confirmPassword: string
}

const VALID_SETUP_VALUES: ValidSetupValues = {
  name: "Admin",
  email: "admin@example.com",
  password: "password123",
  confirmPassword: "password123"
}

function fillValidSetupForm(labels: SetupFieldLabels, values: ValidSetupValues = VALID_SETUP_VALUES): void {
  fireEvent.change(screen.getByLabelText(labels.name), { target: { value: values.name } })
  fireEvent.change(screen.getByLabelText(labels.email), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText(labels.password), { target: { value: values.password } })
  fireEvent.change(screen.getByLabelText(labels.confirmPassword), { target: { value: values.confirmPassword } })
}

function touchSetupField(label: string, value: string): void {
  const input = screen.getByLabelText(label)
  // Type then set the target value: TanStack skips validation when the value is unchanged.
  fireEvent.change(input, { target: { value: `${value}x` } })
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

function successSignUp(calls: SetupSignUpInput[] = []) {
  return async (input: SetupSignUpInput) => {
    calls.push(input)
    return { error: null }
  }
}

interface ValidationCase {
  readonly label: string
  readonly value: string
  readonly expected: string
}

const EN_FIELD_LABELS: SetupFieldLabels = {
  name: "Name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password"
}

const ID_FIELD_LABELS: SetupFieldLabels = {
  name: "Nama",
  email: "Email",
  password: "Password",
  confirmPassword: "Konfirmasi password"
}

const EN_VALIDATION_CASES: readonly ValidationCase[] = [
  { label: "Name", value: "", expected: "Name is required" },
  { label: "Name", value: "a".repeat(65), expected: "Name must be at most 64 characters" },
  { label: "Email", value: "not-an-email", expected: "Enter a valid email address" },
  { label: "Email", value: `${"a".repeat(120)}@example.com`, expected: "Email must be at most 128 characters" },
  { label: "Password", value: "short", expected: "Password must be at least 8 characters" },
  { label: "Password", value: "a".repeat(129), expected: "Password must be at most 128 characters" },
  { label: "Confirm password", value: "", expected: "Confirm your password" }
]

const ID_VALIDATION_CASES: readonly ValidationCase[] = [
  { label: "Nama", value: "", expected: "Nama wajib diisi" },
  { label: "Nama", value: "a".repeat(65), expected: "Nama maksimal 64 karakter" },
  { label: "Email", value: "bukan-email", expected: "Masukkan alamat email yang valid" },
  { label: "Email", value: `${"a".repeat(120)}@example.com`, expected: "Email maksimal 128 karakter" },
  { label: "Password", value: "pendek", expected: "Password minimal 8 karakter" },
  { label: "Password", value: "a".repeat(129), expected: "Password maksimal 128 karakter" },
  { label: "Konfirmasi password", value: "", expected: "Konfirmasi password Anda" }
]

export {
  EN_FIELD_LABELS,
  EN_VALIDATION_CASES,
  ID_FIELD_LABELS,
  ID_VALIDATION_CASES,
  VALID_SETUP_VALUES,
  fillValidSetupForm,
  successSignUp,
  touchSetupField
}
export type { SetupFieldLabels, ValidSetupValues, ValidationCase }
