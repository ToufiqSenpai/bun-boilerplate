import "i18next"

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      // Web owns `home.*`; the backend email templates (type-checked in this program via
      // `import type { App }`) use `email.*` keys resolved through the backend i18n instance.
      translation: typeof import("./locales/en.json") & typeof import("../../backend/src/locales/en.json")
    }
  }
}
