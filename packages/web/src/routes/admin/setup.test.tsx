import { render, screen } from "@testing-library/react"

import { AdminSetupPage, isEmailTakenError, requireSetup } from "src/routes/admin/setup"
interface GuardInput {
  readonly data: { readonly needed: boolean } | null | undefined
  readonly error: unknown
  readonly status: number
}

function isSetupRejected(result: GuardInput): boolean {
  try {
    requireSetup(result)
    return false
  } catch {
    return true
  }
}

describe("requireSetup", () => {
  test("returns the status when setup is needed", () => {
    expect(requireSetup({ data: { needed: true }, error: null, status: 200 })).toEqual({ needed: true })
  })

  test("throws when setup is no longer needed", () => {
    expect(isSetupRejected({ data: { needed: false }, error: null, status: 200 })).toBe(true)
  })

  test("throws on backend error status", () => {
    expect(isSetupRejected({ data: null, error: { message: "boom" }, status: 500 })).toBe(true)
  })
})

describe("isEmailTakenError", () => {
  test("matches duplicate-email server messages", () => {
    expect(isEmailTakenError("User already exists")).toBe(true)
    expect(isEmailTakenError("Email already taken")).toBe(true)
    expect(isEmailTakenError("EMAIL ALREADY TAKEN")).toBe(true)
  })

  test("rejects other server messages", () => {
    expect(isEmailTakenError("Enter a valid email address")).toBe(false)
    expect(isEmailTakenError("Password too weak")).toBe(false)
    expect(isEmailTakenError(undefined)).toBe(false)
  })
})

describe("AdminSetupPage", () => {
  test("renders the setup form through the real route wiring", () => {
    render(<AdminSetupPage />)

    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create admin" })).toBeTruthy()
  })
})
