import { getTextDirection, type Locale } from "@bun-boilerplate/i18n"
import * as Sentry from "@sentry/elysia"
import { CryptoHasher } from "bun"
import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { Body, Head, Html, Tailwind } from "react-email"
import { Resend, type Attachment, type CreateEmailOptions } from "resend"

import { config } from "./config.js"
import { getTranslator } from "./i18n.js"
import { logger } from "./logger.js"

interface SendEmailOptions {
  to: string
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  attachments?: Attachment[]
  headers?: Record<string, string>
  scheduledAt?: string
}

export class EmailService {
  private readonly MAX_RETRIES = 3

  public constructor(private readonly resend: Resend) {}

  public async send(template: EmailTemplate<unknown>, options: SendEmailOptions): Promise<void> {
    const eventType = this.toEventType(template.constructor.name, template.subjectKey())
    const entityId = CryptoHasher.hash("sha256", template.getEntityId(), "hex")
    const idempotencyKey = `${eventType}/${entityId}`

    const payload: CreateEmailOptions = {
      to: [options.to],
      from: config.email.from,
      replyTo: options.replyTo ?? config.email.replyTo,
      react: await template.getTemplate(),
      subject: await template.getSubject()
    }

    if (options.cc !== undefined) payload.cc = options.cc
    if (options.bcc !== undefined) payload.bcc = options.bcc
    if (options.attachments !== undefined) payload.attachments = options.attachments
    if (options.headers !== undefined) payload.headers = options.headers
    if (options.scheduledAt !== undefined) payload.scheduledAt = options.scheduledAt

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
    const toHash = CryptoHasher.hash("sha256", options.to.toLowerCase().trim(), "hex").slice(0, 16)
    Sentry.captureException(new Error(`Email send failed: ${lastError?.message}`), {
      level: "error",
      tags: { component: "email" },
      extra: { statusCode: lastError?.statusCode, toHash }
    })
  }

  private toEventType(constructorName: string, fallbackSubjectKey: string): string {
    const source =
      constructorName && constructorName !== "Object"
        ? constructorName
        : (fallbackSubjectKey.split(".")[1] ?? fallbackSubjectKey)
    return source
      .replace(/Template$/u, "")
      .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
      .replace(/[^a-zA-Z0-9]+/gu, "-")
      .toLowerCase()
      .replace(/^-|-$/gu, "")
  }
}

const resend = new Resend(config.email.resendAPIKey)

export const emailService = new EmailService(resend)

export abstract class EmailTemplate<TProps> {
  public constructor(
    protected readonly locale: Locale,
    protected readonly props: TProps
  ) {}

  public abstract subjectKey(): string
  public abstract buildTemplate(t: TFunction, props: TProps): ReactNode
  public abstract getEntityId(): string

  public async getSubject(): Promise<string> {
    const key = this.subjectKey()

    // subjectKey is a dynamic identifier, so use the defaultValue overload: a typed-escape hatch
    // that also gives a sane fallback when a locale lacks the key.
    return getTranslator(this.locale)(key, { defaultValue: key })
  }

  public async getTemplate(): Promise<ReactNode> {
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
