import { isKnownRole } from "@bun-boilerplate/backend/auth"
import { i18n } from "src/i18n"
import { z } from "zod"

export const userNameSchema = z
  .string()
  .trim()
  .min(1, i18n.t("admin.users.error.name.required"))
  .max(64, i18n.t("admin.users.error.name.max"))

export const userEmailSchema = z
  .email(i18n.t("admin.users.error.email.invalid"))
  .max(128, i18n.t("admin.users.error.email.max"))

export const userPasswordSchema = z
  .string()
  .min(8, i18n.t("admin.users.error.password.min"))
  .max(128, i18n.t("admin.users.error.password.max"))

export const userRoleSchema = z.string().refine(isKnownRole, i18n.t("admin.users.error.role.required"))
