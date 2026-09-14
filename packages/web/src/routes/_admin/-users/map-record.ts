export interface AdminUser {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: string | null
  readonly emailVerified: boolean
  readonly createdAt: string
  readonly banned: boolean
}

export interface AdminSessionInfo {
  readonly id: string
  readonly expiresAt: string
  readonly ipAddress: string | null
  readonly userAgent: string | null
}

export interface RawUserRecord {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly emailVerified: boolean
  readonly createdAt: Date | string
  readonly role?: string | null | undefined
  readonly banned?: boolean | null | undefined
}

export interface RawSessionRecord {
  readonly id: string
  readonly expiresAt: Date | string
  readonly ipAddress?: string | null | undefined
  readonly userAgent?: string | null | undefined
}

export function toIsoString(value: Date | string): string {
  return new Date(value).toISOString()
}

export function toAdminUser(record: RawUserRecord): AdminUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role ?? null,
    emailVerified: record.emailVerified,
    createdAt: toIsoString(record.createdAt),
    banned: record.banned ?? false
  }
}

export function toSessionInfo(record: RawSessionRecord): AdminSessionInfo {
  return {
    id: record.id,
    expiresAt: toIsoString(record.expiresAt),
    ipAddress: record.ipAddress ?? null,
    userAgent: record.userAgent ?? null
  }
}
