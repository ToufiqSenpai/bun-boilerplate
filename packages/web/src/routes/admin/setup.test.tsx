import { notFound } from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import { AdminSetupPage, isEmailTakenError, resolveSetupState } from "src/routes/admin/setup"

describe("resolveSetupState", () => {
  test("returns the form state when setup is needed", () => {
    expect(resolveSetupState({ data: { needed: true }, error: null, status: 200 }, undefined)).toEqual({
      status: "form"
    })
  })

  test("returns the pending state for a returning unverified user carrying their address", () => {
    expect(resolveSetupState({ data: { needed: false }, error: null, status: 200 }, "admin@example.com")).toEqual({
      status: "pending",
      email: "admin@example.com"
    })
  })

  test("throws when setup is complete and no usable address is present", () => {
    expect(() => resolveSetupState({ data: { needed: false }, error: null, status: 200 }, undefined)).toThrow(
      notFound()
    )
    expect(() => resolveSetupState({ data: { needed: false }, error: null, status: 200 }, "not-an-email")).toThrow(
      notFound()
    )
  })

  test("reads a failed setup check as an outage instead of a missing page", () => {
    expect(resolveSetupState({ data: null, error: { message: "boom" }, status: 500 }, undefined)).toEqual({
      status: "outage"
    })
    expect(resolveSetupState({ data: undefined, error: new Error("offline"), status: 0 }, undefined)).toEqual({
      status: "outage"
    })
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

  test("reads a setup outage as an outage with a way back to sign-in", () => {
    render(<AdminSetupPage state={{ status: "outage" }} onBackToLogin={() => {}} />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Something went wrong. Please try again.")
    expect(alert.closest('[data-slot="alert"]')?.className).toContain("text-destructive")
    expect(screen.getByRole("button", { name: "Back to login" })).toBeTruthy()
  })

  test("renders the verification-pending card for a returning unverified user", () => {
    render(<AdminSetupPage state={{ status: "pending", email: "admin@example.com" }} onBackToLogin={() => {}} />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Check your email")
    expect(alert.textContent).toContain("admin@example.com")
  })
})
