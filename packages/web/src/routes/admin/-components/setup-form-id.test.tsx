import { render, screen } from "@testing-library/react"

import { i18n } from "src/i18n"
import { successSignUp } from "src/routes/admin/-components/setup-test-helpers"

await i18n.changeLanguage("id")

const { AdminSetupForm } = await import("src/routes/admin/-components/setup-form")
const { defineSetupFormCases } = await import("src/routes/admin/-components/setup-form-cases")

test("renders header copy and localized labels", () => {
  render(<AdminSetupForm onSignUp={successSignUp()} />)

  expect(screen.getByText("Penyiapan Admin")).toBeTruthy()
  expect(screen.getByText("Buat akun administrator pertama untuk memulai.")).toBeTruthy()
  expect(screen.getByLabelText("Nama")).toBeTruthy()
  expect(screen.getByLabelText("Email")).toBeTruthy()
  expect(screen.getByLabelText("Password")).toBeTruthy()
  expect(screen.getByLabelText("Konfirmasi password")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Buat admin" })).toBeTruthy()
})

defineSetupFormCases("AdminSetupForm (id)", AdminSetupForm, {
  name: "Nama",
  email: "Email",
  password: "Password",
  confirmPassword: "Konfirmasi password",
  title: "Penyiapan Admin",
  submit: "Buat admin",
  submitting: "Membuat…",
  toggleShow: "Tampilkan password",
  toggleHide: "Sembunyikan password",
  nameRequired: "Nama wajib diisi",
  nameMax: "Nama maksimal 64 karakter",
  emailInvalid: "Masukkan alamat email yang valid",
  emailMax: "Email maksimal 128 karakter",
  passwordMin: "Password minimal 8 karakter",
  passwordMax: "Password maksimal 128 karakter",
  confirmRequired: "Konfirmasi password Anda",
  mismatch: "Password tidak sama",
  serverGeneric: "Terjadi kesalahan. Silakan coba lagi."
})
