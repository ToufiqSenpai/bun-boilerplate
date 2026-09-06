import { getTextDirection, type Locale } from "@bun-boilerplate/i18n"
import type { ReactNode } from "react"
import { Body, Head, Html, Preview, Tailwind } from "react-email"

// Component-only on purpose: email templates import this file in the react-email preview
// server (Next), which cannot bundle the bun/Sentry/config side-effects living in
// email-service.ts — same reason getTranslator was split into translator.ts.

export interface BaseEmailProps {
  locale: Locale
}

export interface EmailLayoutProps extends BaseEmailProps {
  preview: string
  children: ReactNode
}

export function EmailLayout({ locale, preview, children }: EmailLayoutProps) {
  return (
    <Html lang={locale} dir={getTextDirection(locale)}>
      <Head />
      <Tailwind>
        <Body className="bg-background font-sans">
          <Preview>{preview}</Preview>
          {children}
        </Body>
      </Tailwind>
    </Html>
  )
}
