import { i18n } from "src/i18n"

await i18n.changeLanguage("id")

const { AdminSetupForm } = await import("src/routes/admin/-components/setup-form")
const { defineSetupFormCases } = await import("src/routes/admin/-components/setup-form-cases")

defineSetupFormCases("AdminSetupForm (id)", AdminSetupForm, {
  name: "Nama",
  email: "Email",
  password: "Password",
  confirmPassword: "Konfirmasi password",
  title: "Penyiapan Admin",
  description: "Buat akun administrator pertama untuk memulai.",
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
