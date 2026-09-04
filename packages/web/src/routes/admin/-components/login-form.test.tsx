import { render, screen } from "@testing-library/react"

import { AdminLoginForm } from "src/routes/admin/-components/login-form"

describe("AdminLoginForm", () => {
  test("renders header copy and localized labels", () => {
    render(<AdminLoginForm onSignIn={async () => ({ error: null })} />)

    expect(screen.getByText("Admin Login")).toBeTruthy()
    expect(screen.getByText("Sign in to access the admin dashboard.")).toBeTruthy()
    expect(screen.getByLabelText("Email")).toBeTruthy()
    expect(screen.getByLabelText("Password")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy()
  })
})
