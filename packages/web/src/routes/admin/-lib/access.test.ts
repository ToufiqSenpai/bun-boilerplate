import { classifySignInError, resolveAdminAccess, sanitizeReturnAddress } from "src/routes/admin/-lib/access"

interface SetupInput {
  readonly data: { readonly needed: boolean } | null | undefined
  readonly error: unknown
  readonly status: number
}

interface SessionInput {
  readonly data: { readonly user: { readonly email: string; readonly emailVerified: boolean; readonly role: string | null } } | null | undefined
  readonly error: unknown
}

interface SessionUser {
  readonly email: string
  readonly emailVerified: boolean
  readonly role: string | null
}

const okSetup = (needed: boolean): SetupInput => ({ data: { needed }, error: null, status: 200 })
const failedSetup = (): SetupInput => ({ data: null, error: { message: "boom" }, status: 500 })
const sessionFor = (user: SessionUser | null): SessionInput => ({ data: user === null ? null : { user }, error: null })

const verifiedAdmin = { email: "admin@example.com", emailVerified: true, role: "admin" } as const

describe("resolveAdminAccess", () => {
  test("setup-needed wins over every session state", () => {
    expect(resolveAdminAccess(okSetup(true), sessionFor(null))).toBe("setup-needed")
    expect(resolveAdminAccess(okSetup(true), sessionFor(verifiedAdmin))).toBe("setup-needed")
    expect(resolveAdminAccess(okSetup(true), sessionFor({ ...verifiedAdmin, emailVerified: false }))).toBe(
      "setup-needed"
    )
  })

  test("anonymous visitors are sent to sign-in", () => {
    expect(resolveAdminAccess(okSetup(false), sessionFor(null))).toBe("sign-in")
    expect(resolveAdminAccess(failedSetup(), sessionFor(null))).toBe("sign-in")
  })

  test("an unverified session is pending verification", () => {
    expect(
      resolveAdminAccess(okSetup(false), sessionFor({ ...verifiedAdmin, emailVerified: false, role: "superadmin" }))
    ).toBe("verification-pending")
  })

  test.each([
    { name: "unknown role", role: "editor" },
    { name: "null role", role: null }
  ])("an incapable session ($name) is forbidden", ({ role }) => {
    expect(resolveAdminAccess(okSetup(false), sessionFor({ ...verifiedAdmin, role }))).toBe("forbidden")
  })

  test("known roles are allowed", () => {
    expect(resolveAdminAccess(okSetup(false), sessionFor({ ...verifiedAdmin, role: "admin" }))).toBe("allowed")
    expect(resolveAdminAccess(okSetup(false), sessionFor({ ...verifiedAdmin, role: "superadmin" }))).toBe("allowed")
  })

  test("a failed setup check falls through to session evaluation", () => {
    expect(resolveAdminAccess(failedSetup(), sessionFor(verifiedAdmin))).toBe("allowed")
  })
})

describe("sanitizeReturnAddress", () => {
  test("accepts internal admin paths untouched", () => {
    expect(sanitizeReturnAddress("/admin")).toBe("/admin")
    expect(sanitizeReturnAddress("/admin/")).toBe("/admin/")
    expect(sanitizeReturnAddress("/admin/articles?sort=asc#row")).toBe("/admin/articles?sort=asc#row")
  })

  test("falls back to the admin home for anything that is not an internal admin path", () => {
    expect(sanitizeReturnAddress(undefined)).toBe("/admin/")
    expect(sanitizeReturnAddress(null)).toBe("/admin/")
    expect(sanitizeReturnAddress("")).toBe("/admin/")
    expect(sanitizeReturnAddress("/")).toBe("/admin/")
    expect(sanitizeReturnAddress("//evil.com")).toBe("/admin/")
    expect(sanitizeReturnAddress("https://evil.com/admin")).toBe("/admin/")
    expect(sanitizeReturnAddress("/administrator")).toBe("/admin/")
    expect(sanitizeReturnAddress("/../admin")).toBe("/admin/")
  })

  test("rejects paths with backslashes or control characters", () => {
    expect(sanitizeReturnAddress("/admin\\..\\evil")).toBe("/admin/")
    expect(sanitizeReturnAddress("/admin\x00evil")).toBe("/admin/")
  })

  test("strips surrounding whitespace before validating", () => {
    expect(sanitizeReturnAddress(" /admin/settings ")).toBe("/admin/settings")
  })
})

describe("classifySignInError", () => {
  test("maps better-auth codes to observability reasons without personal data", () => {
    expect(classifySignInError({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toEqual({
      reason: "pending-verification",
      status: 403
    })
    expect(classifySignInError({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toEqual({
      reason: "bad-credentials",
      status: 401
    })
    expect(classifySignInError({ status: 429 })).toEqual({ reason: "rate-limited", status: 429 })
  })

  test("anything else is unknown", () => {
    expect(classifySignInError({})).toEqual({ reason: "unknown", status: undefined })
    expect(classifySignInError(null)).toEqual({ reason: "unknown", status: undefined })
  })
})
