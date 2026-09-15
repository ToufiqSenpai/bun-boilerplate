import { useCallback, useState } from "react"
import { z } from "zod"

function readValue<S extends z.ZodType>(key: string, schema: S): z.output<S> | null {
  try {
    const raw = sessionStorage.getItem(key)
    const parsed = schema.safeParse(raw === null ? undefined : JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function useSessionStorage<S extends z.ZodType>(key: string, schema: S) {
  const [value, setValue] = useState<z.output<S> | null>(() => readValue(key, schema))

  const set = useCallback(
    (next: z.input<S> | null) => {
      const parsed = next === null ? null : schema.parse(next)
      setValue(parsed)
      try {
        if (parsed === null) {
          sessionStorage.removeItem(key)
        } else {
          sessionStorage.setItem(key, JSON.stringify(parsed))
        }
      } catch {}
    },
    [key, schema]
  )

  return [value, set] as const
}
