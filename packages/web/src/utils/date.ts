import { i18n } from "src/i18n"

export function formatDate(value: Date | number | string): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(value))
}
