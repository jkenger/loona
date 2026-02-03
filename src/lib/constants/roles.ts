export const ROLES = {
  LENDER: "lender",
  AGENT: "agent",
  ADMIN: "admin",
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/**
 * Parse comma-separated roles string into array
 */
export function parseRoles(roleString: string | null | undefined): Role[] {
  if (!roleString) return []
  return roleString.split(",").map((r) => r.trim()) as Role[]
}

/**
 * Check if user has a specific role
 */
export function hasRole(roleString: string | null | undefined, role: Role): boolean {
  if (!roleString) return false
  const roles = parseRoles(roleString)
  return roles.includes(role)
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(roleString: string | null | undefined, roles: Role[]): boolean {
  return roles.some((role) => hasRole(roleString, role))
}

/**
 * Get role checks object for backwards compatibility
 */
export function getRoleChecks(roleString: string | null | undefined) {
  return {
    isAdmin: hasRole(roleString, ROLES.ADMIN),
    isLender: hasRole(roleString, ROLES.LENDER),
    isAgent: hasRole(roleString, ROLES.AGENT),
  }
}
