export type TextDirection = "ltr" | "rtl"

interface LocaleRegistry {
  locale: string
  textDirection: TextDirection
}

const LOCALE_REGISTRY = [
  { locale: "en", textDirection: "ltr" },
  { locale: "id", textDirection: "ltr" }
] as const satisfies readonly LocaleRegistry[]

export type Locale = (typeof LOCALE_REGISTRY)[number]["locale"]

export const DEFAULT_LOCALE: Locale = LOCALE_REGISTRY[0].locale

export const LOCALES: Locale[] = LOCALE_REGISTRY.map(entry => entry.locale)

export function isLocale(value: string): value is Locale {
  return LOCALES.some(locale => locale === value)
}

export function getTextDirection(locale: Locale): TextDirection {
  return LOCALE_REGISTRY.find(entry => entry.locale === locale)?.textDirection ?? LOCALE_REGISTRY[0].textDirection
}
