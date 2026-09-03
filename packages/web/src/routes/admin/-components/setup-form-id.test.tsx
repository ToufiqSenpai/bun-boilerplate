import { render, screen } from "@testing-library/react"

import { i18n } from "src/i18n"
import { successSignUp } from "src/routes/admin/-components/setup-test-helpers"

await i18n.changeLanguage("id")

const { AdminSetupForm } = await import("src/routes/admin/-components/setup-form")
const { defineSetupFormCases } = await import("src/routes/admin/-components/setup-form-cases")

test("evaluates the form under the Indonesian locale", () => {
  render(<AdminSetupForm onSignUp={successSignUp()} />)

  expect(i18n.language).toBe("id")
  expect(screen.getByText("Penyiapan Admin")).toBeTruthy()
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
