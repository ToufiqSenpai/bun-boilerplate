import { faker } from "@faker-js/faker"
import { CryptoHasher } from "bun"
import type { Resend } from "resend"
import { mockDeep } from "vitest-mock-extended"

import { EmailService, EmailTemplate } from "./email.js"

class FakeTemplate extends EmailTemplate<{ entityId: string }> {
  public subjectKey(): string {
    return "email.test.subject"
  }

  public getEntityId(): string {
    return this.props.entityId
  }

  public buildTemplate(): null {
    return null
  }
}

function createResendMock(): Resend {
  return mockDeep<Resend>()
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
    const template = new FakeTemplate("en", { entityId: faker.internet.url() })
    const to = faker.internet.email()

    await service.send(template, { to })

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(1)
    const calls = vi.mocked(resend.emails.send).mock.calls
    // SAFETY: called once, first call exists
    const opts = calls[0]![1] as { idempotencyKey: string }
    const expectedHash = CryptoHasher.hash("sha256", template.getEntityId(), "hex")
    expect(opts.idempotencyKey).toBe(`fake/${expectedHash}`)
  })

  test("idempotencyKey is derived from constructor name and hashed entityId", async () => {
    const resend = createResendMock()
    vi.mocked(resend.emails.send).mockResolvedValue({ data: { id: faker.string.uuid() }, error: null, headers: null })

    const service = new EmailService(resend)
    const entityId = `https://example.com/verify?token=${faker.string.alphanumeric(32)}`
    const template = new FakeTemplate("en", { entityId })

    await service.send(template, { to: faker.internet.email() })

    const calls = vi.mocked(resend.emails.send).mock.calls
    // SAFETY: called once
    const opts = calls[0]![1] as { idempotencyKey: string }
    const expectedHash = CryptoHasher.hash("sha256", entityId, "hex")
    expect(opts.idempotencyKey).toBe(`fake/${expectedHash}`)
    expect(opts.idempotencyKey.length).toBeLessThanOrEqual(256)
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
    const template = new FakeTemplate("en", { entityId: faker.internet.url() })

    const promise = service.send(template, { to: faker.internet.email() })
    await vi.advanceTimersByTimeAsync(9000)
    await promise

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(resend.emails.send).mock.calls
    // SAFETY: two calls exist
    const key1 = (calls[0]![1] as { idempotencyKey: string }).idempotencyKey
    // SAFETY: two calls exist
    const key2 = (calls[1]![1] as { idempotencyKey: string }).idempotencyKey
    expect(key1).toBe(key2)
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
    const promise = service.send(new FakeTemplate("en", { entityId: faker.string.uuid() }), {
      to: faker.internet.email()
    })
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
    await service.send(new FakeTemplate("en", { entityId: faker.string.uuid() }), {
      to: faker.internet.email()
    })

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
    await service.send(new FakeTemplate("en", { entityId: faker.string.uuid() }), {
      to: faker.internet.email()
    })

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
    const promise = service.send(new FakeTemplate("en", { entityId: faker.string.uuid() }), {
      to: faker.internet.email()
    })

    await vi.advanceTimersByTimeAsync(9000)
    await promise

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(3)
  })

  test("forwards cc/bcc/attachments/headers/scheduledAt to payload", async () => {
    const resend = createResendMock()
    vi.mocked(resend.emails.send).mockResolvedValue({ data: { id: faker.string.uuid() }, error: null, headers: null })

    const service = new EmailService(resend)
    const options = {
      to: faker.internet.email(),
      cc: [faker.internet.email()],
      bcc: [faker.internet.email()],
      replyTo: faker.internet.email(),
      headers: { "X-Custom": faker.lorem.word() },
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      attachments: [{ filename: "test.txt", content: Buffer.from("hi") }]
    }

    await service.send(new FakeTemplate("en", { entityId: faker.string.uuid() }), options)

    const calls = vi.mocked(resend.emails.send).mock.calls
    const payload = calls[0]![0]

    expect(payload.cc).toEqual(options.cc)
    expect(payload.bcc).toEqual(options.bcc)
    expect(payload.replyTo).toEqual(options.replyTo)
    expect(payload.headers).toEqual(options.headers)
    expect(payload.scheduledAt).toEqual(options.scheduledAt)
    expect(payload.attachments).toEqual(options.attachments)
  })
})
