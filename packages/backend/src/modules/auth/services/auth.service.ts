import { count } from "drizzle-orm"

import type { Database } from "../../../common/database.js"
import { users } from "../tables/auth.table.js"

export class AuthService {
  public constructor(private readonly database: Database) {}

  public async isSetupNeeded(): Promise<boolean> {
    const [result] = await this.database.select({ value: count() }).from(users)

    return (result?.value ?? 0) === 0
  }
}
