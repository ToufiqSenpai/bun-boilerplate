import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { hash, verify, type Options } from "@node-rs/argon2"
import { betterAuth } from "better-auth"
import { admin, openAPI } from "better-auth/plugins"
import { randomUUIDv7 } from "bun"
import { count, eq } from "drizzle-orm"
import { Elysia } from "elysia"

import { config } from "../../common/config.js"
import { database } from "../../common/database.js"
import { emailService } from "../../common/email.js"
import { logger } from "../../common/logger.js"
import type { OpenApiTag } from "../../common/openapi.js"
import { ac, isKnownRole, roles, type PermissionRequirement } from "./permissions.js"
import { authSetupResponseSchema } from "./schemas/auth.schema.js"
import { AuthService } from "./services/auth.service.js"
import { accounts, sessions, users, verifications } from "./tables/auth.table.js"
import { ResetPasswordTemplate } from "./templates/reset-password.template.js"
import { VerifyEmailTemplate } from "./templates/verify-email.template.js"

// OWASP Password Storage Cheat Sheet recommendation for Argon2id
// Source: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const ARGON2_OPTIONS: Options = {
  memoryCost: 37888, // 37 MiB
  timeCost: 3, // 3 iterations
  parallelism: 1, // 1 parallel lane
  outputLen: 32, // 32 byte output
  algorithm: 2 // Argon2id variant (Algorithm.Argon2id)
}

export const auth = betterAuth({
  database: drizzleAdapter(database, {
    provider: "pg",
    usePlural: true,
    schema: {
      user: users,
      users,
      session: sessions,
      sessions,
      account: accounts,
      accounts,
      verification: verifications,
      verifications
    }
  }),
  logger: {
    level: "info",
    log: (level, message, ...args) => {
      switch (level) {
        case "debug":
          logger.debug(message, ...args)
          break
        case "info":
          logger.info(message, ...args)
          break
        case "warn":
          logger.warn(message, ...args)
          break
        case "error":
          logger.error(message, ...args)
          break
      }
    }
  },
  secret: config.auth.secret,
  baseURL: config.app.baseURL,
  trustedOrigins: config.app.origins,
  socialProviders: {
    google: {
      clientId: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret
    }
  },
  rateLimit: {
    enabled: config.app.environment !== "test",
    window: 10,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": {
        window: 60,
        max: 3
      }
    }
  },
  advanced: {
    database: {
      generateId: () => randomUUIDv7()
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
      trustedProxies: ["127.0.0.1", "172.16.0.0/12"]
    }
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    autoSignIn: false,
    password: {
      hash: password => hash(password, ARGON2_OPTIONS),
      verify: ({ password, hash: storedHash }) => verify(storedHash, password, ARGON2_OPTIONS)
    },
    sendResetPassword: async ({ user, url }) => {
      void emailService
        .send(
          new ResetPasswordTemplate("en", {
            name: user.name,
            email: user.email,
            resetUrl: url,
            expiresInMinutes: 30
          }),
          {
            to: user.email
          }
        )
        .catch(() => {})
    },
    onPasswordReset: async ({ user }) => {
      logger.info({ userId: user.id }, "Password reset completed")
    },
    onExistingUserSignUp: async ({ user }) => {
      logger.warn({ userId: user.id }, "Sign-up attempt for existing email")
    }
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void emailService
        .send(
          new VerifyEmailTemplate("en", {
            name: user.name,
            email: user.email,
            verificationUrl: url,
            expiresInMinutes: 30
          }),
          {
            to: user.email
          }
        )
        .catch(() => {})
    },
    expiresIn: 60 * 30,
    sendOnSignUp: true,
    beforeEmailVerification: async user => {
      logger.debug({ userId: user.id }, "Email verification processed")
    },
    afterEmailVerification: async user => {
      logger.info({ userId: user.id }, "Email verified successfully")
    }
  },
  plugins: [admin({ ac, roles }), ...(config.app.environment === "development" ? [openAPI()] : [])],
  databaseHooks: {
    session: {
      create: {
        after: async session => {
          logger.debug({ userId: session.userId }, "Session created")
        }
      },
      delete: {
        before: async session => {
          logger.debug({ sessionId: session.id }, "Session revoked")
        }
      }
    },
    user: {
      create: {
        after: async user => {
          const [result] = await database.select({ value: count() }).from(users)

          if ((result?.value ?? 0) === 1) {
            await database.update(users).set({ role: "superadmin" }).where(eq(users.id, user.id))
            logger.info({ userId: user.id }, "First user auto-promoted to superadmin")
          }
        }
      },
      update: {
        after: async user => {
          logger.debug({ userId: user.id }, "User updated")
        }
      }
    },
    account: {
      create: {
        after: async account => {
          logger.debug(
            {
              userId: account.userId,
              provider: account.providerId
            },
            "Account linked"
          )
        }
      }
    }
  }
})

const authService = new AuthService(database)

export const authTags: OpenApiTag[] = [
  { name: "Auth", description: "Session-based authentication (better-auth) and setup status" }
]

export const authPlugin = new Elysia({ name: "auth", tags: ["Auth"] })
  .get("/auth/setup", async () => ({ needed: await authService.isSetupNeeded() }), {
    response: authSetupResponseSchema,
    detail: {
      summary: "Check initial setup status",
      description:
        "Reports whether the instance still has no accounts. The first registered user is automatically promoted to superadmin but must verify their email before a session is established."
    }
  })
  .mount(auth.handler)
  .macro("auth", {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers })

      if (!session) return status(401)
      if (!session.user.emailVerified) return status(401)

      return {
        user: session.user,
        session: session.session
      }
    }
  })
  .macro("permissions", (requirement: PermissionRequirement) => ({
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers })

      if (!session) return status(401)
      if (!session.user.emailVerified) return status(401)

      const callerRole = session.user.role

      if (!callerRole || !isKnownRole(callerRole)) return status(403)

      const check = await auth.api.userHasPermission({
        body: { role: callerRole, permissions: requirement }
      })

      if (!check.success) return status(403)

      return {
        user: session.user,
        session: session.session
      }
    }
  }))
