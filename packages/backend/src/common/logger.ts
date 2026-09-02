import pino from "pino"

import { config } from "./config.js"

export const logger = pino({
  level: config.log.level,
  base: { pid: process.pid, env: config.app.environment },
  ...(config.app.environment === "development" &&
    !Bun.isStandaloneExecutable && {
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" }
      }
    })
})
