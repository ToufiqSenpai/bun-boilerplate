import { mockDeep } from "vitest-mock-extended"

import type { Database } from "../../../common/database.js"
import { users } from "../tables/auth.table.js"
import { AuthService } from "./auth.service.js"

describe("AuthService", () => {
  describe("isSetupNeeded", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    test("returns true when no users exist", async () => {
      const database = mockDeep<Database>()

      const from = vi.fn<() => Promise<{ value: number }[]>>().mockResolvedValue([{ value: 0 }])

      // SAFETY: mock select chain for count query
      // SAFETY: drizzle select chain mocked for unit test, from signature matches AuthService usage
      vi.mocked(database.select).mockReturnValue({ from } as never)

      const service = new AuthService(database)
      const result = await service.isSetupNeeded()

      expect(result).toBe(true)
      expect(database.select).toHaveBeenCalledTimes(1)
    })

    test("returns false when at least one user exists", async () => {
      const database = mockDeep<Database>()

      const from = vi.fn<() => Promise<{ value: number }[]>>().mockResolvedValue([{ value: 1 }])

      // SAFETY: drizzle select chain mocked for unit test, from signature matches AuthService usage
      vi.mocked(database.select).mockReturnValue({ from } as never)

      const service = new AuthService(database)
      const result = await service.isSetupNeeded()

      expect(result).toBe(false)
    })

    test("returns false when multiple users exist", async () => {
      const database = mockDeep<Database>()

      const from = vi.fn<() => Promise<{ value: number }[]>>().mockResolvedValue([{ value: 42 }])

      // SAFETY: drizzle select chain mocked for unit test, from signature matches AuthService usage
      vi.mocked(database.select).mockReturnValue({ from } as never)

      const service = new AuthService(database)
      const result = await service.isSetupNeeded()

      expect(result).toBe(false)
    })

    test("queries users table", async () => {
      const database = mockDeep<Database>()

      const from = vi.fn<() => Promise<{ value: number }[]>>().mockResolvedValue([{ value: 0 }])

      // SAFETY: drizzle select chain mocked for unit test, from signature matches AuthService usage
      vi.mocked(database.select).mockReturnValue({ from } as never)

      const service = new AuthService(database)
      await service.isSetupNeeded()

      expect(from).toHaveBeenCalledWith(users)
    })

    test("returns true when count result is undefined", async () => {
      const database = mockDeep<Database>()

      const from = vi.fn<() => Promise<{ value: number }[]>>().mockResolvedValue([])

      // SAFETY: drizzle select chain mocked for unit test, from signature matches AuthService usage
      vi.mocked(database.select).mockReturnValue({ from } as never)

      const service = new AuthService(database)
      const result = await service.isSetupNeeded()

      expect(result).toBe(true)
    })
  })
})
