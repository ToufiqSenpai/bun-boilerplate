import { fireEvent, render, screen } from "@testing-library/react"
import { i18n } from "src/i18n"
import type { SetupSignUpInput } from "src/routes/admin/-components/setup-form"

await i18n.changeLanguage("id")

const { AdminSetupForm } = await import("src/routes/admin/-components/setup-form")

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Admin" } })
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
  fireEvent.change(screen.getByLabelText("Konfirmasi password"), { target: { value: "password123" } })
}

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

    const name = screen.getByLabelText("Nama")
    // Type then clear: TanStack skips validation when the value is unchanged.
    fireEvent.change(name, { target: { value: "x" } })
    fireEvent.change(name, { target: { value: "" } })
    fireEvent.blur(name)
    expect(await screen.findByText("Nama wajib diisi")).toBeTruthy()

    const email = screen.getByLabelText("Email")
    fireEvent.change(email, { target: { value: "bukan-email" } })
    fireEvent.blur(email)
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

    fillValidForm()
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

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Buat admin" }))

    expect(await screen.findByText("Terjadi kesalahan. Silakan coba lagi.")).toBeTruthy()
    expect(calls).toHaveLength(1)
  })
})
