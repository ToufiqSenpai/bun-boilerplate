import { getTextDirection, type Locale } from "@bun-boilerplate/i18n"
import type { ReactNode } from "react"
import { Body, Button, Container, Head, Html, Preview, Section, Tailwind } from "react-email"

// Component-only on purpose: email templates import this file in the react-email preview
// server (Next), which cannot bundle the bun/Sentry/config side-effects living in
// email.service.ts — same reason getTranslator was split into translator.ts.

export interface BaseEmailProps {
  locale: Locale
}

export interface EmailLayoutProps extends BaseEmailProps {
  preview: string
  children: ReactNode
}

export function EmailLayout({ locale, preview, children }: Readonly<EmailLayoutProps>) {
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

export function EmailCard({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Container className="mx-auto py-10 px-5 max-w-xl">
      <Section className="bg-surface rounded p-6">{children}</Section>
    </Container>
  )
}

export function EmailCta({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <Button
      href={href}
      className="bg-brand-primary text-white px-7 py-3.5 rounded block text-center font-bold my-6 no-underline box-border"
    >
      {children}
    </Button>
  )
}
