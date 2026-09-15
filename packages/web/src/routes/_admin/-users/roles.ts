import { isKnownRole, roles } from "@bun-boilerplate/backend/auth"

export const ROLE_OPTIONS = Object.keys(roles).filter(isKnownRole)
