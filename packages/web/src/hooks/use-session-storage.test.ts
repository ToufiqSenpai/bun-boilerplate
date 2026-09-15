import { act, renderHook } from "@testing-library/react"
import { useSessionStorage } from "src/hooks/use-session-storage"
import { ZodError, z } from "zod"

const schema = z.coerce.number().int().positive()
const storageKey = "test:value"

describe("useSessionStorage", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("reads null when nothing is stored", () => {
    const { result } = renderHook(() => useSessionStorage(storageKey, schema))

    expect(result.current[0]).toBeNull()
  })

  it("reads null for invalid stored data", () => {
    sessionStorage.setItem(storageKey, JSON.stringify("nope"))

    const { result } = renderHook(() => useSessionStorage(storageKey, schema))

    expect(result.current[0]).toBeNull()
  })

  it("persists the value on set", () => {
    const { result } = renderHook(() => useSessionStorage(storageKey, schema))

    act(() => {
      result.current[1](123)
    })

    expect(result.current[0]).toBe(123)
    expect(sessionStorage.getItem(storageKey)).toBe("123")
  })

  it("clears storage on null", () => {
    sessionStorage.setItem(storageKey, "123")

    const { result } = renderHook(() => useSessionStorage(storageKey, schema))

    act(() => {
      result.current[1](null)
    })

    expect(result.current[0]).toBeNull()
    expect(sessionStorage.getItem(storageKey)).toBeNull()
  })

  it("throws when the value fails validation", () => {
    const { result } = renderHook(() => useSessionStorage(storageKey, schema))

    expect(() => {
      act(() => {
        result.current[1]("nope")
      })
    }).toThrow(ZodError)
  })
})
