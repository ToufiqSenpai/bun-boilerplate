import * as Sentry from "@sentry/tanstackstart-react"

const sentryDsn = process.env.VITE_SENTRY_DSN

if (!sentryDsn) {
  console.warn("VITE_SENTRY_DSN is not defined. Sentry is not running.")
} else {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    dataCollection: {
      userInfo: false,
      httpBodies: []
    }
  })
}
