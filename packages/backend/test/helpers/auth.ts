import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"

import { database } from "../../src/common/database.js"
import { emailService } from "../../src/common/email.js"
import { auth } from "../../src/modules/auth/index.js"
import { users } from "../../src/modules/auth/tables/auth.table.js"

export async function createAuthSession(role: string): Promise<Record<string, string>> {
  const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

  try {
    const email = faker.internet.email().toLowerCase()
    const password = `${faker.internet.password({ length: 12 })}A1!`
    const name = faker.person.fullName()

    const { response } = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: new Headers(),
      returnHeaders: true
    })

    await database.update(users).set({ role, emailVerified: true }).where(eq(users.id, response.user.id))

    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers(),
      returnHeaders: true
    })

    const cookie = headers
      .getSetCookie()
      .map(cookie => cookie.split(";")[0])
      .join("; ")

    return { cookie }
  } finally {
    spy.mockRestore()
  }
}
