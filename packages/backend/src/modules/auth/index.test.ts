import { isKnownRole, roles } from "./permissions.js"

interface MatrixCase {
  role: keyof typeof roles
  permissions: Record<string, string[]>
  expected: boolean
}

const matrixCases: MatrixCase[] = [
  // Superadmin owns the system (user management plus content).
  { role: "superadmin", permissions: { articleCategory: ["create"] }, expected: true },
  { role: "superadmin", permissions: { articleCategory: ["update"] }, expected: true },
  { role: "superadmin", permissions: { articleCategory: ["delete"] }, expected: true },
  { role: "superadmin", permissions: { user: ["list"] }, expected: true },
  { role: "superadmin", permissions: { user: ["set-role"] }, expected: true },
  { role: "superadmin", permissions: { user: ["ban"] }, expected: true },
  { role: "superadmin", permissions: { session: ["revoke"] }, expected: true },
  // Cross-admin impersonation stays out of scope: nobody holds it.
  { role: "superadmin", permissions: { user: ["impersonate-admins"] }, expected: false },
  // Admin owns content only.
  { role: "admin", permissions: { articleCategory: ["create"] }, expected: true },
  { role: "admin", permissions: { articleCategory: ["update"] }, expected: true },
  { role: "admin", permissions: { articleCategory: ["delete"] }, expected: true },
  { role: "admin", permissions: { user: ["list"] }, expected: false },
  { role: "admin", permissions: { user: ["set-role"] }, expected: false },
  { role: "admin", permissions: { user: ["ban"] }, expected: false },
  { role: "admin", permissions: { session: ["list"] }, expected: false },
  { role: "admin", permissions: { session: ["revoke"] }, expected: false },
  // A freshly registered user owns nothing.
  { role: "user", permissions: { articleCategory: ["create"] }, expected: false },
  { role: "user", permissions: { articleCategory: ["delete"] }, expected: false },
  { role: "user", permissions: { user: ["list"] }, expected: false },
  { role: "user", permissions: { session: ["list"] }, expected: false }
]

describe("access control matrix", () => {
  test.each(matrixCases)("$role with $permissions resolves to $expected", ({ role, permissions, expected }) => {
    expect(roles[role].authorize(permissions).success).toBe(expected)
  })
})

describe("isKnownRole", () => {
  test.each(["superadmin", "admin", "user"])("accepts the static role %s", role => {
    expect(isKnownRole(role)).toBe(true)
  })

  test.each(["root", "", "Admin", "superadmin,admin"])("rejects the unknown role %s", role => {
    expect(isKnownRole(role)).toBe(false)
  })
})
