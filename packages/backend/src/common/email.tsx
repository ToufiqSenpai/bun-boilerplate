import * as Sentry from "@sentry/elysia"
import { CryptoHasher } from "bun"
import type { ReactElement } from "react"
import { Resend, type CreateEmailOptions } from "resend"

import { config } from "./config.js"
import { logger } from "./logger.js"

export interface EmailRenderOptions {
  subject: string
  idempotencyKey: string
  react: ReactElement
}

export interface EmailSendOptions extends EmailRenderOptions {
  to: string
}

export class EmailService {
  private readonly MAX_RETRIES = 3

  public constructor(private readonly resend: Resend) {}

  public async send({ to, subject, react, idempotencyKey }: EmailSendOptions): Promise<void> {
    // Hash the caller-provided key (e.g. "verify-email/user@x.com") so the raw recipient never
    // leaves the process and the key always fits Resend's 256-char limit.
    const key = CryptoHasher.hash("sha256", idempotencyKey, "hex")

    const payload: CreateEmailOptions = {
      to,
      from: config.email.from,
      replyTo: config.email.replyTo,
      react,
      subject
    }

    let lastError: { statusCode?: number | null; message: string } | undefined

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      const { data, error } = await this.resend.emails.send(payload, { idempotencyKey: key })

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
