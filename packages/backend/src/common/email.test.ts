import { faker } from "@faker-js/faker"
import { CryptoHasher } from "bun"
import { createElement } from "react"
import type { Resend } from "resend"
import { mockDeep } from "vitest-mock-extended"

import { EmailService, type SendEmailOptions } from "./email-service.js"

function createOptions(): SendEmailOptions {
  return {
    to: faker.internet.email(),
    subject: faker.lorem.sentence(),
    react: createElement("div"),
    idempotencyKey: `verify-email/${faker.internet.email().toLowerCase()}`
  }
}

function createResendMock(): Resend {
  return mockDeep<Resend>()
}

function sentKey(resend: Resend, index: number): string {
  // SAFETY: test asserts call count before reading
  const opts = vi.mocked(resend.emails.send).mock.calls[index]![1] as { idempotencyKey: string }

  return opts.idempotencyKey
}

describe("EmailService.send", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  test("sends on first attempt", async () => {
    const resend = createResendMock()
    const dataId = faker.string.uuid()
    vi.mocked(resend.emails.send).mockResolvedValue({ data: { id: dataId }, error: null, headers: null })

    const service = new EmailService(resend)
    const options = createOptions()

    await service.send(options)

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(1)
    expect(sentKey(resend, 0)).toBe(CryptoHasher.hash("sha256", options.idempotencyKey, "hex"))
  })

  test("idempotencyKey is a hash of the caller key, stable and bounded", async () => {
    const resend = createResendMock()
    vi.mocked(resend.emails.send).mockResolvedValue({ data: { id: faker.string.uuid() }, error: null, headers: null })

    const service = new EmailService(resend)
    const options = createOptions()

    await service.send(options)

    const key = sentKey(resend, 0)

    expect(key).toBe(CryptoHasher.hash("sha256", options.idempotencyKey, "hex"))
    expect(key.length).toBeLessThanOrEqual(256)
    expect(key).not.toContain(options.to)
  })

  test("retries on 429 and succeeds on second attempt with same idempotencyKey", async () => {
    const resend = createResendMock()
    const dataId = faker.string.uuid()
    vi.mocked(resend.emails.send)
      .mockResolvedValueOnce({
        data: null,
        error: { statusCode: 429, message: "rate limited", name: "rate_limit_exceeded" },
        headers: null
      })
      .mockResolvedValueOnce({ data: { id: dataId }, error: null, headers: null })

    const service = new EmailService(resend)
    const promise = service.send(createOptions())
    await vi.advanceTimersByTimeAsync(9000)
    await promise

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(2)
    expect(sentKey(resend, 0)).toBe(sentKey(resend, 1))
  })

  test("retries on 500 and succeeds", async () => {
    const resend = createResendMock()
    const dataId = faker.string.uuid()
    vi.mocked(resend.emails.send)
      .mockResolvedValueOnce({
        data: null,
        error: { statusCode: 500, message: "server error", name: "internal_server_error" },
        headers: null
      })
      .mockResolvedValueOnce({ data: { id: dataId }, error: null, headers: null })

    const service = new EmailService(resend)
    const promise = service.send(createOptions())
    await vi.advanceTimersByTimeAsync(9000)
    await promise

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(2)
  })

  test("does not retry on 400", async () => {
    const resend = createResendMock()
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: null,
      error: { statusCode: 400, message: "bad request", name: "validation_error" },
      headers: null
    })

    const service = new EmailService(resend)
    await service.send(createOptions())

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(1)
  })

  test("does not retry on 409", async () => {
    const resend = createResendMock()
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: null,
      error: { statusCode: 409, message: "conflict", name: "invalid_idempotent_request" },
      headers: null
    })

    const service = new EmailService(resend)
    await service.send(createOptions())

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(1)
  })

  test("exhausts max retries on persistent 500", async () => {
    const resend = createResendMock()
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: null,
      error: { statusCode: 500, message: "server error", name: "internal_server_error" },
      headers: null
    })

    const service = new EmailService(resend)
    const promise = service.send(createOptions())

    await vi.advanceTimersByTimeAsync(9000)
    await promise

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(3)
  })
})
