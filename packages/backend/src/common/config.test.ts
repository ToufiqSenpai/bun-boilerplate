import { faker } from "@faker-js/faker"

import { configSchema, defaultEnvironment } from "./config.js"

const requiredAuthConfig = {
  secret: faker.string.alphanumeric(32),
  google: {
    clientId: faker.string.alphanumeric(16),
    clientSecret: faker.string.alphanumeric(16)
  }
}

describe("configSchema.auth.emailTokenTtlSeconds", () => {
  test("defaults to 1800 seconds when not provided", () => {
    const parsed = configSchema.shape.auth.parse(requiredAuthConfig)

    expect(parsed.emailTokenTtlSeconds).toBe(1800)
  })

  test("accepts a custom positive value", () => {
    const ttl = faker.number.int({ min: 60, max: 86_400 })
    const parsed = configSchema.shape.auth.parse({ ...requiredAuthConfig, emailTokenTtlSeconds: ttl })

    expect(parsed.emailTokenTtlSeconds).toBe(ttl)
  })

  test("rejects zero and negative values", () => {
    expect(configSchema.shape.auth.safeParse({ ...requiredAuthConfig, emailTokenTtlSeconds: 0 }).success).toBe(false)
    expect(configSchema.shape.auth.safeParse({ ...requiredAuthConfig, emailTokenTtlSeconds: -1 }).success).toBe(false)
  })
})

describe("defaultEnvironment", () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    vi.unstubAllEnvs()

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  test("returns development value when NODE_ENV=development", () => {
    const dev = faker.lorem.word()
    const testVal = faker.lorem.word()
    const prod = faker.lorem.word()

    vi.stubEnv("NODE_ENV", "development")

    expect(defaultEnvironment({ development: dev, test: testVal, production: prod })).toBe(dev)
  })

  test("returns test value when NODE_ENV=test", () => {
    const dev = faker.lorem.word()
    const testVal = faker.lorem.word()
    const prod = faker.lorem.word()

    vi.stubEnv("NODE_ENV", "test")

    expect(defaultEnvironment({ development: dev, test: testVal, production: prod })).toBe(testVal)
  })

  test("returns production value when NODE_ENV=production", () => {
    const dev = faker.lorem.word()
    const testVal = faker.lorem.word()
    const prod = faker.lorem.word()

    vi.stubEnv("NODE_ENV", "production")

    expect(defaultEnvironment({ development: dev, test: testVal, production: prod })).toBe(prod)
  })

  test("falls back to development when NODE_ENV is undefined", () => {
    const dev = faker.lorem.word()
    const prod = faker.lorem.word()

    vi.stubEnv("NODE_ENV", "")
    delete process.env.NODE_ENV

    expect(defaultEnvironment({ development: dev, production: prod })).toBe(dev)
  })

  test("falls back to development when NODE_ENV is invalid string", () => {
    const dev = faker.lorem.word()
    const invalidEnvs = ["staging", "", "PRODUCTION", "prod", "123", "development "]

    for (const env of invalidEnvs) {
      vi.stubEnv("NODE_ENV", env)
      expect(defaultEnvironment({ development: dev, production: faker.lorem.word() })).toBe(dev)
      vi.unstubAllEnvs()
    }
  })

  test("returns undefined when current env key is missing in values", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(defaultEnvironment({ development: faker.lorem.word() })).toBeUndefined()

    vi.stubEnv("NODE_ENV", "test")
    expect(defaultEnvironment({ production: 80 })).toBeUndefined()

    vi.stubEnv("NODE_ENV", "development")
    expect(defaultEnvironment({ production: faker.internet.url() })).toBeUndefined()
  })

  test("returns undefined for empty values object", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(defaultEnvironment({})).toBeUndefined()

    vi.stubEnv("NODE_ENV", "test")
    expect(defaultEnvironment({})).toBeUndefined()

    vi.stubEnv("NODE_ENV", "production")
    expect(defaultEnvironment({})).toBeUndefined()
  })

  test("supports generic T = number (port case)", () => {
    const port = faker.number.int({ min: 1, max: 65535 })

    vi.stubEnv("NODE_ENV", "production")
    expect(defaultEnvironment({ production: port })).toBe(port)

    vi.stubEnv("NODE_ENV", "development")
    expect(defaultEnvironment({ production: port })).toBeUndefined()
  })

  test("supports generic T = object", () => {
    const objDev = { level: "trace", retries: faker.number.int({ min: 1, max: 5 }) }
    const objProd = { level: "info", retries: faker.number.int({ min: 1, max: 5 }) }

    vi.stubEnv("NODE_ENV", "development")
    expect(defaultEnvironment({ development: objDev, production: objProd })).toEqual(objDev)

    vi.stubEnv("NODE_ENV", "production")
    expect(defaultEnvironment({ development: objDev, production: objProd })).toEqual(objProd)
  })

  test("supports generic T = string with faker internet url", () => {
    const url = faker.internet.url()

    vi.stubEnv("NODE_ENV", "test")
    expect(defaultEnvironment({ test: url })).toBe(url)
  })

  test("replicates real usage: port defaultEnvironment({ production: 80 })", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(defaultEnvironment({ production: 80 })).toBe(80)

    vi.stubEnv("NODE_ENV", "development")
    expect(defaultEnvironment({ production: 80 })).toBeUndefined()

    vi.stubEnv("NODE_ENV", "test")
    expect(defaultEnvironment({ production: 80 })).toBeUndefined()
  })

  test("replicates real usage: log level defaultEnvironment", () => {
    const values = {
      development: "trace" as const,
      test: "trace" as const,
      production: "info" as const
    }

    vi.stubEnv("NODE_ENV", "development")
    expect(defaultEnvironment(values)).toBe("trace")

    vi.stubEnv("NODE_ENV", "test")
    expect(defaultEnvironment(values)).toBe("trace")

    vi.stubEnv("NODE_ENV", "production")
    expect(defaultEnvironment(values)).toBe("info")

    vi.stubEnv("NODE_ENV", "staging")
    expect(defaultEnvironment(values)).toBe("trace")
  })

  test("uses faker random values per environment and remains isolated", () => {
    const dev = faker.number.int({ min: 1000, max: 2000 })
    const testVal = faker.number.int({ min: 2000, max: 3000 })
    const prod = faker.number.int({ min: 3000, max: 4000 })
    const values = { development: dev, test: testVal, production: prod }

    vi.stubEnv("NODE_ENV", "development")
    expect(defaultEnvironment(values)).toBe(dev)

    vi.stubEnv("NODE_ENV", "test")
    expect(defaultEnvironment(values)).toBe(testVal)

    vi.stubEnv("NODE_ENV", "production")
    expect(defaultEnvironment(values)).toBe(prod)
  })
})
