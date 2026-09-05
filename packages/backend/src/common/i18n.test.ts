import { DEFAULT_LOCALE, LOCALES } from "@bun-boilerplate/i18n"
import { faker } from "@faker-js/faker"
import { Elysia } from "elysia"

import { localeHeadersSchema, localePlugin, resolveLocale } from "./i18n.js"

describe("resolveLocale", () => {
  test("returns X-Locale when it is a valid locale", () => {
    const locale = faker.helpers.arrayElement([...LOCALES])
    expect(resolveLocale(new Headers({ "x-locale": locale }))).toBe(locale)
  })

  test("normalizes X-Locale case and trims whitespace", () => {
    expect(resolveLocale(new Headers({ "x-locale": "  EN  " }))).toBe("en")
    expect(resolveLocale(new Headers({ "x-locale": " Id " }))).toBe("id")
  })

  test("prefers X-Locale over Accept-Language", () => {
    expect(resolveLocale(new Headers({ "x-locale": "id", "accept-language": "en" }))).toBe("id")
    expect(resolveLocale(new Headers({ "x-locale": "en", "accept-language": "id" }))).toBe("en")
  })

  test("falls back to Accept-Language when X-Locale is missing", () => {
    expect(resolveLocale(new Headers({ "accept-language": "id" }))).toBe("id")
    expect(resolveLocale(new Headers({ "accept-language": "en" }))).toBe("en")
  })

  test("falls back to Accept-Language when X-Locale is invalid", () => {
    expect(resolveLocale(new Headers({ "x-locale": "fr", "accept-language": "id" }))).toBe("id")
    expect(resolveLocale(new Headers({ "x-locale": "xx", "accept-language": "en" }))).toBe("en")
  })

  test("handles Accept-Language with quality values", () => {
    expect(resolveLocale(new Headers({ "accept-language": "en;q=0.5, id;q=0.9" }))).toBe("id")
    expect(resolveLocale(new Headers({ "accept-language": "id;q=0.5, en;q=0.9" }))).toBe("en")
  })

  test("handles regional variants via prefix matching", () => {
    expect(resolveLocale(new Headers({ "accept-language": "en-US,en;q=0.9" }))).toBe("en")
    expect(resolveLocale(new Headers({ "accept-language": "id-ID" }))).toBe("id")
  })

  test("returns DEFAULT_LOCALE when no header matches", () => {
    expect(resolveLocale(new Headers())).toBe(DEFAULT_LOCALE)
    expect(resolveLocale(new Headers({ "accept-language": "fr, de;q=0.9" }))).toBe(DEFAULT_LOCALE)
  })

  test("returns DEFAULT_LOCALE for empty headers", () => {
    expect(resolveLocale(new Headers({ "accept-language": "" }))).toBe(DEFAULT_LOCALE)
    expect(resolveLocale(new Headers({ "x-locale": "" }))).toBe(DEFAULT_LOCALE)
  })

  test("uses negotiator ordering for complex Accept-Language", () => {
    expect(resolveLocale(new Headers({ "accept-language": "fr, en;q=0.8, id;q=0.9" }))).toBe("id")
  })
})

describe("localePlugin", () => {
  test("resolves locale via Elysia resolve", async () => {
    const app = new Elysia().use(localePlugin).get("/", ({ locale }) => locale, {})

    const res1 = await app.handle(new Request("http://localhost/", { headers: { "x-locale": "id" } }))
    expect(await res1.text()).toBe("id")

    const res2 = await app.handle(new Request("http://localhost/", { headers: { "accept-language": "en" } }))
    expect(await res2.text()).toBe("en")

    const res3 = await app.handle(new Request("http://localhost/"))
    expect(await res3.text()).toBe(DEFAULT_LOCALE)
  })

  test("X-Locale takes precedence over Accept-Language in plugin", async () => {
    const app = new Elysia().use(localePlugin).get("/", ({ locale }) => locale, {})

    const res = await app.handle(
      new Request("http://localhost/", { headers: { "x-locale": "en", "accept-language": "id" } })
    )
    expect(await res.text()).toBe("en")
  })
})

describe("localeHeadersSchema", () => {
  test("accepts valid X-Locale", () => {
    const locale = faker.helpers.arrayElement([...LOCALES])
    expect(localeHeadersSchema.safeParse({ "x-locale": locale }).success).toBe(true)
  })

  test("rejects invalid X-Locale", () => {
    const result = localeHeadersSchema.safeParse({ "x-locale": faker.lorem.word() })
    expect(result.success).toBe(false)
    // SAFETY: result.success is false as asserted, error exists for failed parse
    expect((result as { success: false; error: { issues: { message: string }[] } }).error.issues[0]?.message).toBe(
      "Invalid locale"
    )
  })

  test("accepts valid Accept-Language simple and regional", () => {
    expect(localeHeadersSchema.safeParse({ "accept-language": "en" }).success).toBe(true)
    expect(localeHeadersSchema.safeParse({ "accept-language": "id" }).success).toBe(true)
    expect(localeHeadersSchema.safeParse({ "accept-language": "en-US" }).success).toBe(true)
    expect(localeHeadersSchema.safeParse({ "accept-language": "*" }).success).toBe(true)
  })

  test("accepts Accept-Language with q-values and commas", () => {
    expect(localeHeadersSchema.safeParse({ "accept-language": "en;q=0.8, id;q=0.9" }).success).toBe(true)
    expect(localeHeadersSchema.safeParse({ "accept-language": "en-US,en;q=0.9" }).success).toBe(true)
    expect(localeHeadersSchema.safeParse({ "accept-language": "fr, en;q=0.8, id;q=0.9" }).success).toBe(true)
  })

  test("rejects invalid Accept-Language pattern", () => {
    const invalid = faker.helpers.arrayElement(["invalid header !!", "en;q=invalid", "en;q=2", "en,,id"])
    const result = localeHeadersSchema.safeParse({ "accept-language": invalid })
    expect(result.success).toBe(false)
  })

  test("rejects empty Accept-Language string", () => {
    const result = localeHeadersSchema.safeParse({ "accept-language": "" })
    expect(result.success).toBe(false)
  })

  test("accepts missing headers as optional", () => {
    expect(localeHeadersSchema.safeParse({}).success).toBe(true)
  })

  test("accepts combined valid headers", () => {
    const locale = faker.helpers.arrayElement([...LOCALES])
    const result = localeHeadersSchema.safeParse({ "x-locale": locale, "accept-language": "en" })
    expect(result.success).toBe(true)
  })
})
