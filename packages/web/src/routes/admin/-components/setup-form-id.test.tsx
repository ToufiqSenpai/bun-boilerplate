import { fireEvent, render, screen } from "@testing-library/react"

import { i18n } from "src/i18n"
import type { SetupSignUpInput } from "src/routes/admin/-components/setup-form"
import { fillValidSetupForm, touchSetupField } from "src/routes/admin/-components/setup-test-helpers"

await i18n.changeLanguage("id")

const { AdminSetupForm } = await import("src/routes/admin/-components/setup-form")

const LABELS = {
  name: "Nama",
  email: "Email",
  password: "Password",
  confirmPassword: "Konfirmasi password"
} as const
describe("AdminSetupForm (id)", () => {
  test("renders localized header, labels, and button", () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: null })} />)

    expect(screen.getByText("Penyiapan Admin")).toBeTruthy()
    expect(screen.getByText("Buat akun administrator pertama untuk memulai.")).toBeTruthy()
    expect(screen.getByLabelText("Nama")).toBeTruthy()
    expect(screen.getByLabelText("Konfirmasi password")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Buat admin" })).toBeTruthy()
  })

  test("shows localized validation messages", async () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: null })} />)

    touchSetupField("Nama", "")
    expect(await screen.findByText("Nama wajib diisi")).toBeTruthy()

    touchSetupField("Email", "bukan-email")
    expect(await screen.findByText("Masukkan alamat email yang valid")).toBeTruthy()
  })

  test("uses localized password toggle labels", () => {
    render(<AdminSetupForm onSignUp={async () => ({ error: null })} />)

    expect(screen.getAllByRole("button", { name: "Tampilkan password" })).toHaveLength(2)
  })

  test("shows raw server messages as-is with a localized generic fallback", async () => {
    const { unmount } = render(
      <AdminSetupForm onSignUp={async () => ({ error: { message: "Email sudah dipakai" } })} />
    )

    fillValidSetupForm(LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Buat admin" }))
    expect(await screen.findByText("Email sudah dipakai")).toBeTruthy()
    unmount()

    const calls: SetupSignUpInput[] = []
    render(
      <AdminSetupForm
        onSignUp={async input => {
          calls.push(input)
          return { error: {} }
        }}
      />
    )

    fillValidSetupForm(LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Buat admin" }))

    expect(await screen.findByText("Terjadi kesalahan. Silakan coba lagi.")).toBeTruthy()
    expect(calls).toHaveLength(1)
  })
})
