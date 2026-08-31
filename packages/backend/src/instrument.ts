// pinoIntegration is exported by @sentry/bun but not yet re-exported by @sentry/elysia
// Source: https://github.com/getsentry/sentry-javascript/pull/17990
import { pinoIntegration } from "@sentry/bun"
import * as Sentry from "@sentry/elysia"

import { config } from "./common/config.js"

Sentry.init({
  dsn: config.sentry.dsn,
  enabled: config.app.environment !== "test",
  environment: config.app.environment,
  tracesSampleRate: config.app.environment === "production" ? 0.1 : 1.0,
  enableLogs: true,
  integrations: [pinoIntegration()],
  dataCollection: {
    userInfo: false,
    httpBodies: [],
    cookies: false
  },
  ignoreErrors: ["ECONNRESET", /^ETIMEDOUT/]
})
