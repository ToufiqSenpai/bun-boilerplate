import { fireEvent, render, screen } from "@testing-library/react"

import { i18n } from "src/i18n"

await i18n.changeLanguage("id")
const { AdminLoginForm } = await import("src/routes/admin/-components/login-form")

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
}

describe("AdminLoginForm (Locale id)", () => {
  test("renders header copy and labels in Indonesian", () => {
    render(<AdminLoginForm onSignIn={async () => ({ error: null })} />)

    expect(screen.getByText("Login Admin")).toBeTruthy()
    expect(screen.getByText("Masuk untuk mengakses dasbor admin.")).toBeTruthy()
    expect(screen.getByLabelText("Password")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Masuk" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Tampilkan password" })).toBeTruthy()
  })

  test("shows Indonesian inline validation errors", async () => {
    render(<AdminLoginForm onSignIn={async () => ({ error: null })} />)

    const passwordInput = screen.getByLabelText("Password")
    fireEvent.change(passwordInput, { target: { value: "temporary" } })
    fireEvent.change(passwordInput, { target: { value: "" } })
    fireEvent.blur(passwordInput)

    expect(await screen.findByText("Password wajib diisi")).toBeTruthy()
  })

  test("shows the localized generic invalid-credentials alert", async () => {
    render(<AdminLoginForm onSignIn={async () => ({ error: { message: "User not found" } })} />)

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))

    expect(await screen.findByText("Email atau password salah")).toBeTruthy()
    expect(screen.queryByText("User not found")).toBeNull()
  })
})
