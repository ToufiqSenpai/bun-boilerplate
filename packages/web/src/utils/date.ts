import { DEFAULT_LOCALE, isLocale, type Locale } from "@bun-boilerplate/i18n"
import type { DayPickerLocale } from "react-day-picker"
import { enUS, id as idLocale } from "react-day-picker/locale"
import { i18n } from "src/i18n"

const dayPickerLocales = {
  en: enUS,
  id: idLocale
} satisfies Record<Locale, DayPickerLocale>

export function formatDate(value: Date | number | string): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(value))
}

export function dayPickerLocale(): DayPickerLocale {
  const language = i18n.language

  return dayPickerLocales[isLocale(language) ? language : DEFAULT_LOCALE]
}
