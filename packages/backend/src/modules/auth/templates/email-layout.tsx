import { getTextDirection, type Locale } from "@bun-boilerplate/i18n"
import type { ReactNode } from "react"
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Tailwind, Text } from "react-email"

export interface EmailLayoutProps {
  locale: Locale
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

export interface ActionEmailProps {
  heading: string
  intro: string
  expires: string
  ctaLabel: string
  url: string
  footnotes: string[]
  fallbackLabel: string
}

export function ActionEmail({ heading, intro, expires, ctaLabel, url, footnotes, fallbackLabel }: ActionEmailProps) {
  return (
    <Container className="mx-auto py-10 px-5 max-w-xl">
      <Section className="bg-surface rounded p-6">
        <Heading as="h1" className="text-2xl font-bold text-gray-800">
          {heading}
        </Heading>
        <Text className="text-base leading-7 text-gray-800">{intro}</Text>
        <Text className="text-base leading-7 text-gray-800">{expires}</Text>
        <Button
          href={url}
          className="bg-brand-primary text-white px-7 py-3.5 rounded block text-center font-bold my-6 no-underline box-border"
        >
          {ctaLabel}
        </Button>
        <Hr className="border-solid border-gray-200 my-6" />
        {footnotes.map(footnote => (
          <Text key={footnote} className="text-sm text-gray-500 leading-5">
            {footnote}
          </Text>
        ))}
        <Text className="text-sm text-gray-500 leading-5">{fallbackLabel}</Text>
        <Link href={url} className="text-sm text-brand-secondary break-all">
          {url}
        </Link>
      </Section>
    </Container>
  )
}
