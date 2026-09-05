import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@bun-boilerplate/i18n"
import { Elysia } from "elysia"
import Negotiator from "negotiator"
import { z } from "zod"

export function resolveLocale(headers: Headers): Locale {
  const xLocale = headers.get("x-locale")?.trim().toLowerCase()
  if (xLocale && isLocale(xLocale)) return xLocale

  const header = headers.get("accept-language")
  if (!header || header.trim() === "") return DEFAULT_LOCALE

  const negotiator = new Negotiator({ headers: { "accept-language": header } })
  const picked = negotiator.language([...LOCALES])
  return picked && isLocale(picked) ? picked : DEFAULT_LOCALE
}

const ACCEPT_LANGUAGE_PATTERN =
  /^(?:\*|[a-zA-Z]{1,8}(?:-[a-zA-Z0-9]{1,8})*)(?:\s*;\s*q\s*=\s*(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?(?:\s*,\s*(?:\*|[a-zA-Z]{1,8}(?:-[a-zA-Z0-9]{1,8})*)(?:\s*;\s*q\s*=\s*(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?)*$/

export const localeHeadersSchema = z.object({
  "x-locale": z
    .enum(LOCALES, { error: "Invalid locale" })
    .optional()
    .describe("Explicit locale override, takes precedence over Accept-Language"),
  "accept-language": z
    .string({ error: "Invalid Accept-Language header" })
    .regex(ACCEPT_LANGUAGE_PATTERN, { error: "Invalid Accept-Language header" })
    .optional()
    .describe("Standard Accept-Language header with q-values, e.g. en-US,en;q=0.9,id;q=0.8")
})

export const localePlugin = new Elysia({ name: "locale" })
  .resolve(({ request }) => ({
    locale: resolveLocale(request.headers)
  }))
  .as("scoped")
