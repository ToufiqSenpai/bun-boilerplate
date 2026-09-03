import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

export type ArticleCategoryAction = "create" | "update" | "delete"

export interface PermissionRequirement {
  articleCategory?: ArticleCategoryAction[]
}

export const ac = createAccessControl({
  ...defaultStatements,
  articleCategory: ["create", "update", "delete"]
})

export const roles = {
  superadmin: ac.newRole({
    ...adminAc.statements,
    articleCategory: ["create", "update", "delete"]
  }),
  admin: ac.newRole({
    user: [],
    session: [],
    articleCategory: ["create", "update", "delete"]
  }),
  user: ac.newRole({
    user: [],
    session: [],
    articleCategory: []
  })
}

export type Role = keyof typeof roles

export function isKnownRole(role: string): role is Role {
  return role in roles
}
