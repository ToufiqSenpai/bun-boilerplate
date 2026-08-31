export const hasRole = (user: { role?: string | null | undefined }, role: string): boolean =>
  user.role?.split(",").includes(role) ?? false
