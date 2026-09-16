import { useCallback, useEffect, useRef, useState } from "react"
import { useSessionStorage } from "src/hooks/use-session-storage"
import { z } from "zod"

const SEND_COOLDOWN_SECONDS = 60
const cooldownExpirySchema = z.number().int().positive()

export class RateLimitedError extends Error {
  public constructor() {
    super("Rate limited")
    this.name = "RateLimitedError"
  }
}

interface SendCooldownMessages {
  readonly rateLimited: string
  readonly generic: string
}

interface UseSendCooldownOptions {
  readonly storageKey: string
  readonly send: () => Promise<void>
  readonly messages: SendCooldownMessages
}

function remainingSeconds(expiresAt: number | null, now: number) {
  if (expiresAt === null) return 0
  return Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

export function useSendCooldown({ storageKey, send, messages }: UseSendCooldownOptions) {
  const [cooldownExpiresAt, setCooldownExpiresAt] = useSessionStorage(storageKey, cooldownExpirySchema)
  const [now, setNow] = useState(() => Date.now())
  const [sent, setSent] = useState(() => remainingSeconds(cooldownExpiresAt, Date.now()) > 0)
  const [sending, setSending] = useState(() => remainingSeconds(cooldownExpiresAt, Date.now()) === 0)
  const [error, setError] = useState<string | null>(null)
  const autoSendRef = useRef(false)
  const cooldown = remainingSeconds(cooldownExpiresAt, now)

  const runSend = useCallback(async () => {
    setSending(true)
    setError(null)

    try {
      await send()
      setSent(true)
      setNow(Date.now())
      setCooldownExpiresAt(Date.now() + SEND_COOLDOWN_SECONDS * 1000)
    } catch (cause) {
      setSent(false)
      setError(cause instanceof RateLimitedError ? messages.rateLimited : messages.generic)
    } finally {
      setSending(false)
    }
  }, [send, messages.rateLimited, messages.generic, setCooldownExpiresAt])

  useEffect(() => {
    if (cooldownExpiresAt !== null && cooldownExpiresAt > Date.now()) return
    if (autoSendRef.current) return
    autoSendRef.current = true
    void runSend()
  }, [cooldownExpiresAt, runSend])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearTimeout(timer)
    }
  }, [cooldown])

  useEffect(() => {
    const sync = () => {
      setNow(Date.now())
    }
    document.addEventListener("visibilitychange", sync)
    return () => {
      document.removeEventListener("visibilitychange", sync)
    }
  }, [])

  return { cooldown, sending, sent, error, send: runSend }
}
