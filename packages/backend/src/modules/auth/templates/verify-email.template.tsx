import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { Button, Container, Heading, Hr, Link, Preview, Section, Text } from "react-email"

import { EmailTemplate } from "../../../common/email.js"

export interface VerifyEmailProps {
  name: string
  email: string
  verificationUrl: string
  expiresInMinutes: number
}

export class VerifyEmailTemplate extends EmailTemplate<VerifyEmailProps> {
  public subjectKey(): string {
    return "email.verifyEmail.subject"
  }

  public getEntityId(): string {
    return this.props.verificationUrl
  }

  public buildTemplate(t: TFunction, props: VerifyEmailProps): ReactNode {
    const { name, email, verificationUrl, expiresInMinutes } = props

    return (
      <>
        <Preview>{t("email.verifyEmail.preview")}</Preview>
        <Container className="mx-auto py-10 px-5 max-w-xl">
          <Section className="bg-surface rounded p-6">
            <Heading as="h1" className="text-2xl font-bold text-gray-800">
              {t("email.verifyEmail.title")}
            </Heading>
            <Text className="text-base leading-7 text-gray-800">{t("email.verifyEmail.intro", { name, email })}</Text>
            <Text className="text-base leading-7 text-gray-800">
              {t("email.verifyEmail.expires", { expires: expiresInMinutes })}
            </Text>
            <Button
              href={verificationUrl}
              className="bg-brand-primary text-white px-7 py-3.5 rounded block text-center font-bold my-6 no-underline box-border"
            >
              {t("email.verifyEmail.cta")}
            </Button>
            <Hr className="border-solid border-gray-200 my-6" />
            <Text className="text-sm text-gray-500 leading-5">{t("email.verifyEmail.ignore")}</Text>
            <Text className="text-sm text-gray-500 leading-5">{t("email.verifyEmail.fallbackLabel")}</Text>
            <Link href={verificationUrl} className="text-sm text-brand-secondary break-all">
              {verificationUrl}
            </Link>
          </Section>
        </Container>
      </>
    )
  }
}
