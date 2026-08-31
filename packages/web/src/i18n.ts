import { createI18n } from "@bun-boilerplate/i18n"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json" with { type: "json" }
import id from "./locales/id.json" with { type: "json" }

export const i18n = await createI18n({
  modules: [initReactI18next],
  resources: {
    en: { translation: en },
    id: { translation: id }
  }
})
