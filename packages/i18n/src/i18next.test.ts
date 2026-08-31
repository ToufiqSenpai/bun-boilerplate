import type { ThirdPartyModule } from "i18next"

import { createI18n } from "./i18next.js"
import { DEFAULT_LOCALE, LOCALES } from "./locales.js"

test("createI18n applies defaults from locales", async () => {
  const i18n = await createI18n({ resources: { en: { translation: { hello: "Hello" } } } })
  const supportedLngs = i18n.options.supportedLngs

  expect(i18n.language).toBe(DEFAULT_LOCALE)
  expect(Array.isArray(supportedLngs) ? supportedLngs.filter(lng => lng !== "cimode") : []).toEqual([...LOCALES])
  expect(i18n.t("hello")).toBe("Hello")
})

test("createI18n registers modules before init", async () => {
  let initialized = false

  const module: ThirdPartyModule = {
    type: "3rdParty",
    init: () => {
      initialized = true
    }
  }
  const i18n = await createI18n({ modules: [module], resources: {} })

  expect(initialized).toBe(true)
  expect(i18n.isInitialized).toBe(true)
})

test("createI18n allows overriding options", async () => {
  const i18n = await createI18n({
    lng: "id",
    resources: {
      id: { translation: { hello: "Halo" } },
      en: { translation: { hello: "Hello" } }
    }
  })

  expect(i18n.language).toBe("id")
  expect(i18n.t("hello")).toBe("Halo")
})

test("createI18n falls back to DEFAULT_LOCALE for missing translations", async () => {
  const i18n = await createI18n({
    lng: "id",
    resources: {
      en: { translation: { hello: "Hello" } }
    }
  })

  expect(i18n.t("hello")).toBe("Hello")
})
