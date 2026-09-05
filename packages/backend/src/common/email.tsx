import { getTextDirection, type Locale } from "@bun-boilerplate/i18n"
import * as Sentry from "@sentry/elysia"
import { CryptoHasher } from "bun"
import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { Body, Head, Html, Tailwind } from "react-email"
import { Resend, type CreateEmailOptions } from "resend"

import { config } from "./config.js"
import { getTranslator } from "./i18n.js"
import { logger } from "./logger.js"

export class EmailService {
  private readonly MAX_RETRIES = 3

  public constructor(private readonly resend: Resend) {}

  public async send(template: EmailTemplate<unknown>, to: string): Promise<void> {
    const idempotencyKey = CryptoHasher.hash("sha256", `${template.subjectKey()}/${template.getEntityId()}`, "hex")

    const payload: CreateEmailOptions = {
      to,
      from: config.email.from,
      replyTo: config.email.replyTo,
      react: template.getTemplate(),
      subject: template.getSubject()
    }

    let lastError: { statusCode?: number | null; message: string } | undefined

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      const { data, error } = await this.resend.emails.send(payload, { idempotencyKey })

      if (!error) {
        logger.info({ messageId: data.id }, "Email sent")
        return
      }

      lastError = { statusCode: error.statusCode, message: error.message }

      const retryable = error.statusCode === 429 || (error.statusCode !== null && error.statusCode >= 500)
      if (!retryable || attempt === this.MAX_RETRIES) break

      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 500
      logger.warn({ attempt: attempt + 1, delayMs: delay }, "Retrying email send")
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    logger.error({ statusCode: lastError?.statusCode, error: lastError?.message }, "Email send failed")
    const toHash = CryptoHasher.hash("sha256", to.toLowerCase().trim(), "hex").slice(0, 16)
    Sentry.captureException(new Error(`Email send failed: ${lastError?.message}`), {
      level: "error",
      tags: { component: "email" },
      extra: { statusCode: lastError?.statusCode, toHash }
    })
  }
}

export const emailService = new EmailService(new Resend(config.email.resendAPIKey))

export abstract class EmailTemplate<TProps> {
  public constructor(
    protected readonly locale: Locale,
    protected readonly props: TProps
  ) {}

  public abstract subjectKey(): string
  public abstract buildTemplate(t: TFunction, props: TProps): ReactNode
  public abstract getEntityId(): string

  public getSubject(): string {
    const key = this.subjectKey()

    // subjectKey is a dynamic identifier, so use the defaultValue overload: a typed-escape hatch
    // that also gives a sane fallback when a locale lacks the key.
    return getTranslator(this.locale)(key, { defaultValue: key })
  }

  public getTemplate(): ReactNode {
    const t = getTranslator(this.locale)

    return (
      <Html lang={this.locale} dir={getTextDirection(this.locale)}>
        <Head />
        <Tailwind>
          <Body className="bg-background font-sans">{this.buildTemplate(t, this.props)}</Body>
        </Tailwind>
      </Html>
    )
  }
}
