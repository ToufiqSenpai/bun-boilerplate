export type TextDirection = "ltr" | "rtl"

export const LOCALES = ["en", "id"] as const

export type Locale = (typeof LOCALES)[number]

const DIRECTIONS = {
  en: "ltr",
  id: "ltr"
} as const satisfies Record<Locale, TextDirection>

export const DEFAULT_LOCALE: Locale = LOCALES[0]

export function isLocale(value: string): value is Locale {
  return value in DIRECTIONS
}

export function getTextDirection(locale: Locale): TextDirection {
  return DIRECTIONS[locale]
}
