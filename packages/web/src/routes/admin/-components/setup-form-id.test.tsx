import { fireEvent, render, screen } from "@testing-library/react"

import { i18n } from "src/i18n"
import {
  ID_FIELD_LABELS,
  ID_VALIDATION_CASES,
  fillValidSetupForm,
  successSignUp,
  touchSetupField
} from "src/routes/admin/-components/setup-test-helpers"

await i18n.changeLanguage("id")

const { AdminSetupForm } = await import("src/routes/admin/-components/setup-form")

describe("AdminSetupForm (id)", () => {
  test("evaluates the form under the Indonesian locale", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    expect(i18n.language).toBe("id")
    expect(screen.getByText("Penyiapan Admin")).toBeTruthy()
    expect(screen.getByText("Buat akun administrator pertama untuk memulai.")).toBeTruthy()
    expect(screen.getByLabelText(ID_FIELD_LABELS.name)).toBeTruthy()
    expect(screen.getByLabelText(ID_FIELD_LABELS.confirmPassword)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Buat admin" })).toBeTruthy()
  })

  test.each(ID_VALIDATION_CASES)("shows inline error: $expected", async ({ label, value, expected }) => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    touchSetupField(label, value)

    expect(await screen.findByText(expected)).toBeTruthy()
  })

  test("shows inline mismatch error for confirm password", async () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    fireEvent.change(screen.getByLabelText(ID_FIELD_LABELS.password), { target: { value: "password123" } })
    touchSetupField(ID_FIELD_LABELS.confirmPassword, "berbeda")
    expect(await screen.findByText("Password tidak sama")).toBeTruthy()
  })

  test("uses localized password toggle labels", () => {
    render(<AdminSetupForm onSignUp={successSignUp()} />)

    expect(screen.getAllByRole("button", { name: "Tampilkan password" })).toHaveLength(2)
  })

  test("shows raw server messages as-is with a localized generic fallback", async () => {
    const { unmount } = render(<AdminSetupForm onSignUp={async () => ({ error: { message: "Email sudah dipakai" } })} />)

    fillValidSetupForm(ID_FIELD_LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Buat admin" }))
    expect(await screen.findByText("Email sudah dipakai")).toBeTruthy()
    unmount()

    render(<AdminSetupForm onSignUp={async () => ({ error: {} })} />)

    fillValidSetupForm(ID_FIELD_LABELS)
    fireEvent.click(screen.getByRole("button", { name: "Buat admin" }))

    expect(await screen.findByText("Terjadi kesalahan. Silakan coba lagi.")).toBeTruthy()
  })
})
