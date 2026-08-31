import { createInstance, type i18n as I18nInstance, type InitOptions, type Module } from "i18next"

import { DEFAULT_LOCALE, LOCALES } from "./locales.js"

export interface CreateI18nOptions extends Partial<InitOptions> {
  modules?: Module[]
}

export async function createI18n(options: CreateI18nOptions = {}): Promise<I18nInstance> {
  const instance = createInstance()

  for (const module of options.modules ?? []) {
    instance.use(module)
  }

  await instance.init({
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...LOCALES],
    interpolation: { escapeValue: false },
    ...options
  })

  return instance
}
