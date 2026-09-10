import { count, eq, sql } from "drizzle-orm"

import type { Database } from "../../../common/database.js"
import { users } from "../tables/auth.table.js"

export class AuthService {
  public constructor(private readonly database: Database) {}

  public async isSetupNeeded(): Promise<boolean> {
    const [result] = await this.database.select({ value: count() }).from(users)

    return (result?.value ?? 0) === 0
  }

  public async ensureSuperadmin(userId: string): Promise<boolean> {
    return await this.database.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('auth:first-user-promotion'))`)

      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "superadmin"))
        .limit(1)

      if (existing) return false

      const promoted = await tx
        .update(users)
        .set({ role: "superadmin" })
        .where(eq(users.id, userId))
        .returning({ id: users.id })

      return promoted.length > 0
    })
  }
}
