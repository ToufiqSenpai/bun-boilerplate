import type { AdminSessionInfo } from "src/routes/_admin/-users/user-drawer"
import type { AdminUser } from "src/routes/_admin/-users/users-page"

export interface RawUserRecord {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly emailVerified: boolean
  readonly createdAt: Date | string
  readonly role?: string | null
  readonly banned?: boolean | null
  readonly banReason?: string | null
  readonly banExpires?: Date | string | null
}

export interface RawSessionRecord {
  readonly id: string
  readonly expiresAt: Date | string
  readonly ipAddress?: string | null
  readonly userAgent?: string | null
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
    banned: record.banned ?? false,
    banReason: record.banReason ?? null,
    banExpires: record.banExpires ? toIsoString(record.banExpires) : null
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
