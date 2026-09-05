export type AdminAccess = "setup-needed" | "sign-in" | "verification-pending" | "forbidden" | "allowed"

export interface AdminSetupStatus {
  readonly needed: boolean
}

export interface AdminSetupResult {
  readonly data: AdminSetupStatus | null | undefined
  readonly error: unknown
  readonly status: number
}

export interface AdminSessionUser {
  readonly email: string
  readonly emailVerified: boolean
  readonly role: string | null
}

export interface AdminSessionData {
  readonly user: AdminSessionUser
}

export interface AdminSessionResult {
  readonly data: AdminSessionData | null | undefined
  readonly error: unknown
}

const KNOWN_ROLES = new Set(["superadmin", "admin"])
const DEFAULT_RETURN_ADDRESS = "/admin/"
const RETURN_ADDRESS_PATTERN = /^\/admin(?:\/|$)/
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7E]*$/

export function resolveAdminAccess(setup: AdminSetupResult, session: AdminSessionResult): AdminAccess {
  if (setup.error === null && setup.status === 200 && setup.data?.needed) return "setup-needed"

  const user = session.data?.user

  if (!user) return "sign-in"
  if (!user.emailVerified) return "verification-pending"
  if (!user.role || !KNOWN_ROLES.has(user.role)) return "forbidden"

  return "allowed"
}

export function sanitizeReturnAddress(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ""

  if (trimmed === "" || !RETURN_ADDRESS_PATTERN.test(trimmed) || !PRINTABLE_ASCII_PATTERN.test(trimmed)) {
    return DEFAULT_RETURN_ADDRESS
  }

  return trimmed
}

export type SignInFailureReason = "bad-credentials" | "pending-verification" | "rate-limited" | "unknown"

export interface SignInFailure {
  readonly reason: SignInFailureReason
  readonly status: number | undefined
}

export function classifySignInError(
  error:
    | {
        readonly code?: string | undefined
        readonly status?: number | undefined
        readonly message?: string | undefined
      }
    | null
    | undefined
): SignInFailure {
  if (error?.code === "EMAIL_NOT_VERIFIED") return { reason: "pending-verification", status: error.status }
  if (error?.status === 429) return { reason: "rate-limited", status: error.status }
  if (error?.code === "INVALID_EMAIL_OR_PASSWORD") return { reason: "bad-credentials", status: error.status }

  return { reason: "unknown", status: error?.status }
}
