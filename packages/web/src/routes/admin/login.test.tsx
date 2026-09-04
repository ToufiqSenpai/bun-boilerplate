import { render, screen } from "@testing-library/react"
import { AdminLoginPage, requireSetupComplete } from "src/routes/admin/login"

interface GuardInput {
  readonly data: { readonly needed: boolean } | null | undefined
  readonly error: unknown
  readonly status: number
}

function redirectsToSetup(result: GuardInput): boolean {
  try {
    requireSetupComplete(result)
    return false
  } catch {
    return true
  }
}

describe("requireSetupComplete", () => {
  test("redirects to /admin/setup when setup is still needed", () => {
    expect(redirectsToSetup({ data: { needed: true }, error: null, status: 200 })).toBe(true)
  })

  test("allows sign-in when setup is complete", () => {
    expect(redirectsToSetup({ data: { needed: false }, error: null, status: 200 })).toBe(false)
  })

  test("allows sign-in when the setup check fails", () => {
    expect(redirectsToSetup({ data: null, error: { message: "boom" }, status: 500 })).toBe(false)
  })
})

describe("AdminLoginPage", () => {
  test("renders the login form through the real route wiring", () => {
    render(<AdminLoginPage />)

    expect(screen.getByText("Admin Login")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy()
  })
})
