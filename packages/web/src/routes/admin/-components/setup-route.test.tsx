import { render, screen } from "@testing-library/react"

import { AdminSetupPage, requireSetupNeeded } from "src/routes/admin/setup"

interface GuardInput {
  readonly data: { readonly needed: boolean } | null | undefined
  readonly error: unknown
  readonly status: number
}

function isSetupRejected(result: GuardInput): boolean {
  try {
    requireSetupNeeded(result)
    return false
  } catch {
    return true
  }
}

describe("requireSetupNeeded", () => {
  test("returns the status when setup is needed", () => {
    expect(requireSetupNeeded({ data: { needed: true }, error: null, status: 200 })).toEqual({ needed: true })
  })

  test("throws when setup is no longer needed", () => {
    expect(isSetupRejected({ data: { needed: false }, error: null, status: 200 })).toBe(true)
  })

  test("throws on backend error status", () => {
    expect(isSetupRejected({ data: null, error: { message: "boom" }, status: 500 })).toBe(true)
  })
})

describe("AdminSetupPage", () => {
  test("renders the setup form through the real route wiring", () => {
    render(<AdminSetupPage />)

    expect(screen.getByText("Admin Setup")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create admin" })).toBeTruthy()
  })
})
