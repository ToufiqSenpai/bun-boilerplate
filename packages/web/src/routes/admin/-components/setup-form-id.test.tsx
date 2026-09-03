import { fireEvent, render, screen } from "@testing-library/react"

import { i18n } from "src/i18n"
import { fillValidSetupForm, successSignUp, touchSetupField } from "src/routes/admin/-components/setup-test-helpers"

await i18n.changeLanguage("id")

const { AdminSetupForm } = await import("src/routes/admin/-components/setup-form")

const LABELS = {
  name: "Nama",
  email: "Email",
  password: "Password",
  confirmPassword: "Konfirmasi password"
} as const

const validationCases = [
  { label: "Nama", value: "", expected: "Nama wajib diisi" },
  { label: "Nama", value: "a".repeat(65), expected: "Nama maksimal 64 karakter" },
  { label: "Email", value: "bukan-email", expected: "Masukkan alamat email yang valid" },
  { label: "Email", value: `${"a".repeat(120)}@example.com`, expected: "Email maksimal 128 karakter" },
  { label: "Password", value: "pendek", expected: "Password minimal 8 karakter" },
  { label: "Password", value: "a".repeat(129), expected: "Password maksimal 128 karakter" },
  { label: "Konfirmasi password", value: "", expected: "Konfirmasi password Anda" }
]

describe("AdminSetupForm (id)", () => {
  test("evaluates the form under the Indonesian locale", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    expect(i18n.language).toBe("id")
    expect(screen.getByText("Penyiapan Admin")).toBeTruthy()
    expect(screen.getByText("Buat akun administrator pertama untuk memulai.")).toBeTruthy()
    expect(screen.getByLabelText(LABELS.name)).toBeTruthy()
    expect(screen.getByLabelText(LABELS.confirmPassword)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Buat admin" })).toBeTruthy()
  })

  test.each(validationCases)("shows inline error: $expected", async ({ label, value, expected }) => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField(label, value)

    expect(await screen.findByText(expected)).toBeTruthy()
  })

  test("shows inline mismatch error for confirm password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fireEvent.change(screen.getByLabelText(LABELS.password), { target: { value: "password123" } })
    touchSetupField(LABELS.confirmPassword, "berbeda")
    expect(await screen.findByText("Password tidak sama")).toBeTruthy()
  })

  test("uses localized password toggle labels", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    expect(screen.getAllByRole("button", { name: "Tampilkan password" })).toHaveLength(2)
  })

  test("shows raw server messages as-is with a localized generic fallback", async () => {
    const { unmount } = render(<AdminSetupForm onSignUp={async () => ({ error: { message: "Email sudah dipakai" } })} />)

    fillValidSetupForm(LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Buat admin" }))
    expect(await screen.findByText("Email sudah dipakai")).toBeTruthy()
    unmount()

    render(<AdminSetupForm onSignUp={async () => ({ error: {} })} />)

    fillValidSetupForm(LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Buat admin" }))

    expect(await screen.findByText("Terjadi kesalahan. Silakan coba lagi.")).toBeTruthy()
  })
})
