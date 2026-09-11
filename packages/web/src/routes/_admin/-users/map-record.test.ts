import {
  toAdminUser,
  toSessionInfo,
  type RawSessionRecord,
  type RawUserRecord
} from "src/routes/_admin/-users/map-record"

const baseUser: RawUserRecord = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@dev.io",
  emailVerified: true,
  createdAt: "2026-01-02T00:00:00.000Z"
}

describe("toAdminUser", () => {
  test("keeps ISO strings as ISO strings", () => {
    expect(toAdminUser(baseUser).createdAt).toBe("2026-01-02T00:00:00.000Z")
  })

  test("normalizes Date objects revived by the better-auth client", () => {
    const revived: RawUserRecord = {
      ...baseUser,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      banned: true,
      banExpires: new Date("2026-09-01T00:00:00.000Z")
    }

    const mapped = toAdminUser(revived)

    expect(mapped.createdAt).toBe("2026-01-02T00:00:00.000Z")
    expect(mapped.banExpires).toBe("2026-09-01T00:00:00.000Z")
    expect(mapped.banned).toBe(true)
  })
})

describe("toSessionInfo", () => {
  test("normalizes Date expiry and keeps display fields", () => {
    const record: RawSessionRecord = {
      id: "s1",
      expiresAt: new Date("2026-09-20T00:00:00.000Z"),
      ipAddress: "203.0.113.7",
      userAgent: null
    }

    expect(toSessionInfo(record)).toEqual({
      id: "s1",
      expiresAt: "2026-09-20T00:00:00.000Z",
      ipAddress: "203.0.113.7",
      userAgent: null
    })
  })
})
