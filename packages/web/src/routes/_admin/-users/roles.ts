import type { Role } from "@bun-boilerplate/backend/auth"

export const ROLE_OPTIONS = ["admin", "superadmin"] as const satisfies readonly Role[]

export function isMatrixRole(value: string | null | undefined): value is Role {
  return ROLE_OPTIONS.some(option => option === value)
}
