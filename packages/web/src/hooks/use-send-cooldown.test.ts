import { act, renderHook } from "@testing-library/react"
import { RateLimitedError, useSendCooldown } from "src/hooks/use-send-cooldown"

const storageKey = "test:cooldown"
const messages = {
  rateLimited: "Too many attempts. Please wait a minute and try again.",
  generic: "Something went wrong. Please try again."
}

function renderCooldown(send: () => Promise<void>) {
  return renderHook(() => useSendCooldown({ storageKey, send, messages: { ...messages } }))
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe("useSendCooldown", () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("sends once on mount when no cooldown is stored", async () => {
    const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const { result } = renderCooldown(send)

    await flush()

    expect(send).toHaveBeenCalledTimes(1)
    expect(result.current.sent).toBe(true)
    expect(result.current.sending).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.cooldown).toBe(60)
  })

  it("does not send while a stored cooldown is still running", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify(Date.now() + 30_000))
    const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const { result } = renderCooldown(send)

    await flush()

    expect(send).not.toHaveBeenCalled()
    expect(result.current.sent).toBe(true)
    expect(result.current.cooldown).toBe(30)
  })

  it("does not auto-send when a stored cooldown lapses while mounted", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify(Date.now() + 2000))
    const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const { result } = renderCooldown(send)
    await flush()

    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
    }

    expect(result.current.cooldown).toBe(0)
    expect(send).not.toHaveBeenCalled()
  })

  it("keeps the cooldown across a remount inside the window", async () => {
    const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const first = renderCooldown(send)
    await flush()
    first.unmount()

    const second = renderCooldown(send)
    await flush()

    expect(send).toHaveBeenCalledTimes(1)
    expect(second.result.current.cooldown).toBeGreaterThan(0)
  })

  it("counts the cooldown down as time passes", async () => {
    const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const { result } = renderCooldown(send)
    await flush()

    for (let tick = 0; tick < 5; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
    }

    expect(result.current.cooldown).toBe(55)
  })

  it("leaves the page retryable after a failed send", async () => {
    const send = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("network"))
    const { result } = renderCooldown(send)
    await flush()

    expect(result.current.sent).toBe(false)
    expect(result.current.sending).toBe(false)
    expect(result.current.error).toBe(messages.generic)

    await act(async () => {
      await result.current.send()
    })

    expect(send).toHaveBeenCalledTimes(2)
  })

  it("maps a rate-limited error to the rate-limited message", async () => {
    const send = vi.fn<() => Promise<void>>().mockRejectedValue(new RateLimitedError())
    const { result } = renderCooldown(send)
    await flush()

    expect(result.current.sent).toBe(false)
    expect(result.current.error).toBe(messages.rateLimited)
  })
})
