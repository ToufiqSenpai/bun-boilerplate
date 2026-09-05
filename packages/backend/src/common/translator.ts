import { createI18n } from "@bun-boilerplate/i18n"
import type { Locale } from "@bun-boilerplate/i18n"
import type { TFunction } from "i18next"

import en from "../locales/en.json" with { type: "json" }
import id from "../locales/id.json" with { type: "json" }

// Framework-free on purpose: email templates import this at render time, including in the
// react-email preview server, which cannot bundle the Elysia/negotiator imports living in i18n.ts.
const i18n = await createI18n({
  resources: {
    en: { translation: en },
    id: { translation: id }
  }
})

export function getTranslator(locale: Locale): TFunction {
  return i18n.getFixedT(locale)
}
