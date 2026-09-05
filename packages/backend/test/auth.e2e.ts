import { treaty } from "@elysiajs/eden"
import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"

import { database } from "../src/common/database.js"
import { app } from "../src/main.js"
import { auth } from "../src/modules/auth/index.js"
import { sessions, users } from "../src/modules/auth/tables/auth.table.js"
import { createAuthSession, createVerifiedUser, signUpUnverified } from "./helpers/auth.js"

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

    const { userId, token } = await signUpUnverified()

    const [row] = await database.select().from(users).where(eq(users.id, userId))

    expect(row?.role).toBe("superadmin")
    expect(row?.emailVerified).toBe(false)
    expect(token).toBeNull()

    const userSessions = await database.select().from(sessions).where(eq(sessions.userId, userId))
    expect(userSessions).toHaveLength(0)

    const { data, status } = await api.api.auth.setup.get()
    expect(status).toBe(200)
    expect(data?.needed).toBe(false)
  })

  test("signup captures the locale from the x-locale header", async () => {
    const { userId } = await signUpUnverified(new Headers({ "x-locale": "id" }))

    const [row] = await database.select().from(users).where(eq(users.id, userId))

    expect(row?.locale).toBe("id")
  })

  test("signup falls back to the default locale when no header is sent", async () => {
    const { userId } = await signUpUnverified()

    const [row] = await database.select().from(users).where(eq(users.id, userId))

    expect(row?.locale).toBe("en")
  })

  test("second user keeps the default role", async () => {
    await database.delete(users)

    const first = await signUpUnverified()
    const second = await signUpUnverified()

    const [row1] = await database.select().from(users).where(eq(users.id, first.userId))
    const [row2] = await database.select().from(users).where(eq(users.id, second.userId))

    expect(row1?.role).toBe("superadmin")
    expect(row2?.role).toBe("user")
  })
})

describe("session verification gate", () => {
  async function createUnverifiedSuperadminCookie(): Promise<{ cookie: string; userId: string }> {
    const user = await createVerifiedUser("superadmin")

    // Real signed session cookie: verified just long enough to sign in, then flipped back to unverified.
    await database.update(users).set({ emailVerified: false }).where(eq(users.id, user.userId))

    return user
  }

  function articleCategoryBody() {
    return {
      locale: "en" as const,
      name: faker.lorem.words({ min: 1, max: 3 }),
      slug: faker.lorem.slug(),
      description: faker.lorem.sentence()
    }
  }

  function postArticleCategory(headers: Record<string, string>) {
    return api.api["article-categories"].post(articleCategoryBody(), { headers })
  }

  test("request without a session is rejected with 401", async () => {
    const { error, status } = await postArticleCategory({})

    expect(status).toBe(401)
    expect(error).not.toBeNull()
  })

  test("session of an unverified user is rejected with 401", async () => {
    const { cookie, userId } = await createUnverifiedSuperadminCookie()

    // Guard: the session itself resolves, so the 401 below comes from the gate, not a missing session.
    const resolved = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(resolved?.user.id).toBe(userId)

    const { error, status } = await postArticleCategory({ cookie })

    expect(status).toBe(401)
    expect(error).not.toBeNull()
  })

  test("session of a verified admin still passes the gate", async () => {
    const { cookie } = await createAuthSession("admin")

    const { data, error, status } = await postArticleCategory({ cookie })

    expect(status).toBe(201)
    expect(error).toBeNull()
    expect(data?.slug).toBeDefined()
  })

  test("session of a verified non-admin is still rejected with 403", async () => {
    const { cookie } = await createAuthSession("user")

    const { error, status } = await postArticleCategory({ cookie })

    expect(status).toBe(403)
    expect(error).not.toBeNull()
  })

  test("session of a verified superadmin passes the permission check", async () => {
    const { cookie } = await createAuthSession("superadmin")

    const { data, error, status } = await postArticleCategory({ cookie })

    expect(status).toBe(201)
    expect(error).toBeNull()
    expect(data?.slug).toBeDefined()
  })

  test("a demoted admin loses write access on the very next request", async () => {
    const { cookie, userId } = await createVerifiedUser("admin")

    expect((await postArticleCategory({ cookie })).status).toBe(201)

    await database.update(users).set({ role: "user" }).where(eq(users.id, userId))

    const { error, status } = await postArticleCategory({ cookie })

    expect(status).toBe(403)
    expect(error).not.toBeNull()
  })
})
