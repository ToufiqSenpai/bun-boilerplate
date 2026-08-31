import { DEFAULT_LOCALE, getTextDirection, isLocale, LOCALES, type Locale, type TextDirection } from "./locales.js"

const DIRECTIONS = {
  en: "ltr",
  id: "ltr"
} as const satisfies Record<Locale, TextDirection>

test("DEFAULT_LOCALE is part of LOCALES", () => {
  expect(LOCALES).toContain(DEFAULT_LOCALE)
})

test("LOCALES matches the registry", () => {
  expect(LOCALES).toEqual(["en", "id"])
})

test("isLocale accepts supported locales", () => {
  for (const locale of LOCALES) {
    expect(isLocale(locale)).toBe(true)
  }
})

test("isLocale rejects unsupported values", () => {
  expect(isLocale("ja")).toBe(false)
  expect(isLocale("")).toBe(false)
  expect(isLocale("EN")).toBe(false)
})

test("getTextDirection returns the registered direction", () => {
  for (const locale of LOCALES) {
    expect(getTextDirection(locale)).toBe(DIRECTIONS[locale])
  }
})
