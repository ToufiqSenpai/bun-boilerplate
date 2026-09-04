import { treaty } from "@elysiajs/eden"
import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"

import { database } from "../src/common/database.js"
import { emailService } from "../src/common/email.js"
import { app } from "../src/main.js"
import { auth } from "../src/modules/auth/index.js"
import { sessions, users } from "../src/modules/auth/tables/auth.table.js"
import { createAuthSession } from "./helpers/auth.js"

const api = treaty(app)

describe("GET /api/auth/setup", () => {
  test("returns needed true on fresh database", async () => {
    const { data, error, status } = await api.api.auth.setup.get()

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data).toEqual({ needed: true })
  })

  test("returns needed false after first user exists", async () => {
    await createAuthSession("admin")

    const { data, error, status } = await api.api.auth.setup.get()

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data).toEqual({ needed: false })
  })

  test("first signup via better-auth becomes superadmin but stays unverified without a session", async () => {
    await database.delete(users)

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

      const [row] = await database.select().from(users).where(eq(users.id, response.user.id))

      expect(row?.role).toBe("superadmin")
      expect(row?.emailVerified).toBe(false)
      expect(response.token).toBeNull()

      const userSessions = await database.select().from(sessions).where(eq(sessions.userId, response.user.id))
      expect(userSessions).toHaveLength(0)

      const { data, status } = await api.api.auth.setup.get()
      expect(status).toBe(200)
      expect(data?.needed).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  test("second user keeps the default role", async () => {
    await database.delete(users)

    const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

    try {
      const email1 = faker.internet.email().toLowerCase()
      const password1 = `${faker.internet.password({ length: 12 })}A1!`
      const name1 = faker.person.fullName()

      const email2 = faker.internet.email().toLowerCase()
      const password2 = `${faker.internet.password({ length: 12 })}A1!`
      const name2 = faker.person.fullName()

      const { response: r1 } = await auth.api.signUpEmail({
        body: { email: email1, password: password1, name: name1 },
        headers: new Headers(),
        returnHeaders: true
      })

      const { response: r2 } = await auth.api.signUpEmail({
        body: { email: email2, password: password2, name: name2 },
        headers: new Headers(),
        returnHeaders: true
      })

      const [row1] = await database.select().from(users).where(eq(users.id, r1.user.id))
      const [row2] = await database.select().from(users).where(eq(users.id, r2.user.id))

      expect(row1?.role).toBe("superadmin")
      expect(row2?.role).toBe("user")
    } finally {
      spy.mockRestore()
    }
  })
})

describe("session verification gate", () => {
  async function createUnverifiedSuperadminCookie(): Promise<{ cookie: string; userId: string }> {
    const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

    try {
      const email = faker.internet.email().toLowerCase()
      const password = `${faker.internet.password({ length: 12 })}A1!`

      const { response } = await auth.api.signUpEmail({
        body: { email, password, name: faker.person.fullName() },
        headers: new Headers(),
        returnHeaders: true
      })

      // Real signed session cookie: verify just long enough to sign in, then flip back to unverified.
      await database
        .update(users)
        .set({ role: "superadmin", emailVerified: true })
        .where(eq(users.id, response.user.id))

      const { headers } = await auth.api.signInEmail({
        body: { email, password },
        headers: new Headers(),
        returnHeaders: true
      })

      await database.update(users).set({ emailVerified: false }).where(eq(users.id, response.user.id))

      const cookie = headers
        .getSetCookie()
        .map(entry => entry.split(";")[0])
        .join("; ")

      return { cookie, userId: response.user.id }
    } finally {
      spy.mockRestore()
    }
  }

  function articleCategoryBody() {
    return {
      locale: "en" as const,
      name: faker.lorem.words({ min: 1, max: 3 }),
      slug: faker.lorem.slug(),
      description: faker.lorem.sentence()
    }
  }

  test("request without a session is rejected with 401", async () => {
    const { error, status } = await api.api["article-categories"].post(articleCategoryBody())

    expect(status).toBe(401)
    expect(error).not.toBeNull()
  })

  test("session of an unverified user is rejected with 401", async () => {
    const { cookie, userId } = await createUnverifiedSuperadminCookie()

    // Guard: the session itself resolves, so the 401 below comes from the gate, not a missing session.
    const resolved = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(resolved?.user.id).toBe(userId)

    const { error, status } = await api.api["article-categories"].post(articleCategoryBody(), {
      headers: { cookie }
    })

    expect(status).toBe(401)
    expect(error).not.toBeNull()
  })

  test("session of a verified admin still passes the gate", async () => {
    const { cookie } = await createAuthSession("admin")

    const { data, error, status } = await api.api["article-categories"].post(articleCategoryBody(), {
      headers: { cookie }
    })

    expect(status).toBe(201)
    expect(error).toBeNull()
    expect(data?.slug).toBeDefined()
  })

  test("session of a verified non-admin is still rejected with 403", async () => {
    const { cookie } = await createAuthSession("user")

    const { error, status } = await api.api["article-categories"].post(articleCategoryBody(), {
      headers: { cookie }
    })

    expect(status).toBe(403)
    expect(error).not.toBeNull()
  })

  test("session of a verified superadmin passes the permission check", async () => {
    const { cookie } = await createAuthSession("superadmin")

    const { data, error, status } = await api.api["article-categories"].post(articleCategoryBody(), {
      headers: { cookie }
    })

    expect(status).toBe(201)
    expect(error).toBeNull()
    expect(data?.slug).toBeDefined()
  })

  test("a demoted admin loses write access on the very next request", async () => {
    const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

    try {
      const email = faker.internet.email().toLowerCase()
      const password = `${faker.internet.password({ length: 12 })}A1!`

      const { response } = await auth.api.signUpEmail({
        body: { email, password, name: faker.person.fullName() },
        headers: new Headers(),
        returnHeaders: true
      })

      await database.update(users).set({ role: "admin", emailVerified: true }).where(eq(users.id, response.user.id))

      const { headers } = await auth.api.signInEmail({
        body: { email, password },
        headers: new Headers(),
        returnHeaders: true
      })

      const cookie = headers
        .getSetCookie()
        .map(entry => entry.split(";")[0])
        .join("; ")

      const before = await api.api["article-categories"].post(articleCategoryBody(), {
        headers: { cookie }
      })
      expect(before.status).toBe(201)

      await database.update(users).set({ role: "user" }).where(eq(users.id, response.user.id))

      const { error, status } = await api.api["article-categories"].post(articleCategoryBody(), {
        headers: { cookie }
      })

      expect(status).toBe(403)
      expect(error).not.toBeNull()
    } finally {
      spy.mockRestore()
    }
  })
})
