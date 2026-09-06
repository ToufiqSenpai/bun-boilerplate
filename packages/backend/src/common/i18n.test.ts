import { DEFAULT_LOCALE, LOCALES, type Locale } from "@bun-boilerplate/i18n"
import { faker } from "@faker-js/faker"
import { Elysia } from "elysia"

import { localeHeadersSchema, localePlugin, resolveLocale } from "./i18n.js"

describe("resolveLocale", () => {
  test.each([
    { label: "returns X-Locale when it is a valid locale", headers: { "x-locale": "id" }, expected: "id" },
    { label: "normalizes X-Locale case and trims whitespace", headers: { "x-locale": "  EN  " }, expected: "en" },
    { label: "normalizes X-Locale case and trims whitespace", headers: { "x-locale": " Id " }, expected: "id" },
    {
      label: "prefers X-Locale over Accept-Language",
      headers: { "x-locale": "id", "accept-language": "en" },
      expected: "id"
    },
    {
      label: "prefers X-Locale over Accept-Language",
      headers: { "x-locale": "en", "accept-language": "id" },
      expected: "en"
    },
    {
      label: "falls back to Accept-Language when X-Locale is missing",
      headers: { "accept-language": "id" },
      expected: "id"
    },
    {
      label: "falls back to Accept-Language when X-Locale is missing",
      headers: { "accept-language": "en" },
      expected: "en"
    },
    {
      label: "falls back to Accept-Language when X-Locale is invalid",
      headers: { "x-locale": "fr", "accept-language": "id" },
      expected: "id"
    },
    {
      label: "falls back to Accept-Language when X-Locale is invalid",
      headers: { "x-locale": "xx", "accept-language": "en" },
      expected: "en"
    },
    {
      label: "handles Accept-Language with quality values",
      headers: { "accept-language": "en;q=0.5, id;q=0.9" },
      expected: "id"
    },
    {
      label: "handles Accept-Language with quality values",
      headers: { "accept-language": "id;q=0.5, en;q=0.9" },
      expected: "en"
    },
    {
      label: "handles regional variants via prefix matching",
      headers: { "accept-language": "en-US,en;q=0.9" },
      expected: "en"
    },
    { label: "handles regional variants via prefix matching", headers: { "accept-language": "id-ID" }, expected: "id" },
    { label: "returns DEFAULT_LOCALE when no header matches", headers: {}, expected: DEFAULT_LOCALE },
    {
      label: "returns DEFAULT_LOCALE when no header matches",
      headers: { "accept-language": "fr, de;q=0.9" },
      expected: DEFAULT_LOCALE
    },
    {
      label: "returns DEFAULT_LOCALE for empty header values",
      headers: { "accept-language": "" },
      expected: DEFAULT_LOCALE
    },
    { label: "returns DEFAULT_LOCALE for empty header values", headers: { "x-locale": "" }, expected: DEFAULT_LOCALE },
    {
      label: "uses negotiator ordering for complex Accept-Language",
      headers: { "accept-language": "fr, en;q=0.8, id;q=0.9" },
      expected: "id"
    }
  ] satisfies { label: string; headers: HeadersInit; expected: Locale }[])("$label", ({ headers, expected }) => {
    expect(resolveLocale(new Headers(headers))).toBe(expected)
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
