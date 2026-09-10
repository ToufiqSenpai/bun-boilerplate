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

  describe("ensureSuperadmin", () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    interface TxStubOptions {
      existing: { id: string }[]
      promoted: { id: string }[]
    }

    function createTx({ existing, promoted }: TxStubOptions) {
      const limit = vi.fn<() => Promise<{ id: string }[]>>().mockResolvedValue(existing)
      const selectWhere = vi.fn<() => { limit: typeof limit }>(() => ({ limit }))
      const from = vi.fn<() => { where: typeof selectWhere }>(() => ({ where: selectWhere }))
      const select = vi.fn<() => { from: typeof from }>(() => ({ from }))

      const returning = vi.fn<() => Promise<{ id: string }[]>>().mockResolvedValue(promoted)
      const updateWhere = vi.fn<() => { returning: typeof returning }>(() => ({ returning }))
      const set = vi.fn<(values: { role: string }) => { where: typeof updateWhere }>(() => ({ where: updateWhere }))
      const update = vi.fn<() => { set: typeof set }>(() => ({ set }))

      const execute = vi.fn<() => Promise<object[]>>().mockResolvedValue([])

      return { execute, select, update, handles: { set, updateWhere, returning } }
    }

    function createService(options: TxStubOptions) {
      const database = mockDeep<Database>()
      const tx = createTx(options)

      // SAFETY: tx handles mirror the drizzle transaction handle the service receives
      database.transaction.mockImplementation(async callback => callback(tx as never))

      return { service: new AuthService(database), tx }
    }

    test("promotes the user when no superadmin exists", async () => {
      const { service, tx } = createService({ existing: [], promoted: [{ id: "user-1" }] })

      const result = await service.ensureSuperadmin("user-1")

      expect(result).toBe(true)
      expect(tx.handles.set).toHaveBeenCalledWith({ role: "superadmin" })
      expect(tx.handles.updateWhere).toHaveBeenCalledTimes(1)
      expect(tx.execute).toHaveBeenCalledTimes(1)
    })

    test("skips when a superadmin already exists", async () => {
      const { service, tx } = createService({ existing: [{ id: "admin-1" }], promoted: [] })

      const result = await service.ensureSuperadmin("user-2")

      expect(result).toBe(false)
      expect(tx.update).not.toHaveBeenCalled()
    })

    test("returns false when the update matches no rows", async () => {
      const { service } = createService({ existing: [], promoted: [] })

      const result = await service.ensureSuperadmin("user-3")

      expect(result).toBe(false)
    })
  })
})
