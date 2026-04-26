/**
 * Role Hierarchy
 *
 * Encodes the inheritance chain and provides permission resolution.
 *
 * Hierarchy (ascending privilege):
 *
 *   PauseAdmin (10) → ConfigAdmin (20) → SuperAdmin (30)
 *
 * Each role inherits all permissions of every role below it.
 * SuperAdmin has every permission in the system.
 */

import {
  Role,
  Permission,
  RoleLevel,
  ALL_ROLES,
  ROLE_DIRECT_PERMISSIONS,
  RoleHierarchyNode,
} from "./types";

// ── Inheritance chain ─────────────────────────────────────────────────────────

/**
 * Returns all roles that `role` inherits from, ordered from lowest to highest.
 * Does not include `role` itself.
 *
 * SuperAdmin  → [PauseAdmin, ConfigAdmin]
 * ConfigAdmin → [PauseAdmin]
 * PauseAdmin  → []
 */
export function getInheritedRoles(role: Role): Role[] {
  const level = RoleLevel[role];
  return ALL_ROLES.filter((r) => RoleLevel[r] < level);
}

/**
 * Returns all roles that inherit from `role` (i.e. roles above it).
 *
 * PauseAdmin  → [ConfigAdmin, SuperAdmin]
 * ConfigAdmin → [SuperAdmin]
 * SuperAdmin  → []
 */
export function getRolesInheritingFrom(role: Role): Role[] {
  const level = RoleLevel[role];
  return ALL_ROLES.filter((r) => RoleLevel[r] > level);
}

// ── Permission resolution ─────────────────────────────────────────────────────

/**
 * Returns the full set of permissions for `role`, including all inherited ones.
 *
 * Computed by collecting direct permissions from `role` and every role it
 * inherits from, then deduplicating.
 */
export function getEffectivePermissions(role: Role): Permission[] {
  const roles = [...getInheritedRoles(role), role];
  const seen = new Set<Permission>();
  for (const r of roles) {
    for (const p of ROLE_DIRECT_PERMISSIONS[r]) {
      seen.add(p);
    }
  }
  return Array.from(seen);
}

/**
 * Returns true if `role` has `permission` (directly or via inheritance).
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return getEffectivePermissions(role).includes(permission);
}

/**
 * Returns the minimum role required to hold `permission`, or null if no
 * role grants it (should never happen for valid permissions).
 */
export function minimumRoleFor(permission: Permission): Role | null {
  for (const role of ALL_ROLES) {
    if (roleHasPermission(role, permission)) return role;
  }
  return null;
}

/**
 * Returns true if `candidate` is at least as privileged as `required`.
 */
export function roleAtLeast(candidate: Role, required: Role): boolean {
  return RoleLevel[candidate] >= RoleLevel[required];
}

// ── Hierarchy introspection ───────────────────────────────────────────────────

/**
 * Build a full `RoleHierarchyNode` for every role.
 * Useful for rendering the hierarchy in a UI.
 */
export function buildHierarchy(): Record<Role, RoleHierarchyNode> {
  const result = {} as Record<Role, RoleHierarchyNode>;
  for (const role of ALL_ROLES) {
    result[role] = {
      role,
      level: RoleLevel[role],
      inheritsFrom: getInheritedRoles(role),
      inheritedBy: getRolesInheritingFrom(role),
      directPermissions: ROLE_DIRECT_PERMISSIONS[role],
      effectivePermissions: getEffectivePermissions(role),
    };
  }
  return result;
}
