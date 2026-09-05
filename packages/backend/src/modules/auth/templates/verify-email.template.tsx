import { Button, Container, Heading, Hr, Link, Section, Text } from "react-email"

import { EmailLayout, type BaseEmailProps } from "../../../common/email.js"
import { getTranslator } from "../../../common/translator.js"

export interface VerifyEmailProps extends BaseEmailProps {
  name: string
  email: string
  verificationUrl: string
  expiresInMinutes: number
}

export default function VerifyEmail(props: VerifyEmailProps) {
  const t = getTranslator(props.locale)

  return (
    <EmailLayout locale={props.locale} preview={t("email.verifyEmail.preview")}>
      <Container className="mx-auto py-10 px-5 max-w-xl">
        <Section className="bg-surface rounded p-6">
          <Heading as="h1" className="text-2xl font-bold text-gray-800">
            {t("email.verifyEmail.title")}
          </Heading>
          <Text className="text-base leading-7 text-gray-800">
            {t("email.verifyEmail.intro", { name: props.name, email: props.email })}
          </Text>
          <Text className="text-base leading-7 text-gray-800">
            {t("email.verifyEmail.expires", { expires: props.expiresInMinutes })}
          </Text>
          <Button
            href={props.verificationUrl}
            className="bg-brand-primary text-white px-7 py-3.5 rounded block text-center font-bold my-6 no-underline box-border"
          >
            {t("email.verifyEmail.cta")}
          </Button>
          <Hr className="border-solid border-gray-200 my-6" />
          <Text className="text-sm text-gray-500 leading-5">{t("email.verifyEmail.ignore")}</Text>
          <Text className="text-sm text-gray-500 leading-5">{t("email.verifyEmail.fallbackLabel")}</Text>
          <Link href={props.verificationUrl} className="text-sm text-brand-secondary break-all">
            {props.verificationUrl}
          </Link>
        </Section>
      </Container>
    </EmailLayout>
  )
}

VerifyEmail.PreviewProps = {
  locale: "en",
  name: "John",
  email: "john@example.com",
  verificationUrl: "https://example.com/verify/token-abc123",
  expiresInMinutes: 30
} satisfies VerifyEmailProps

export const verifyEmailOptions = (props: VerifyEmailProps) => ({
  to: props.email,
  subject: getTranslator(props.locale)("email.verifyEmail.subject"),
  idempotencyKey: `verify-email/${props.email.toLowerCase().trim()}`,
  react: <VerifyEmail {...props} />
})
