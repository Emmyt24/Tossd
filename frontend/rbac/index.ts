/**
 * RBAC module public API
 *
 * ```ts
 * import { createRbac, RoleRegistry, PermissionGuard } from "../rbac";
 * ```
 */

// Types
export type {
  Role,
  Permission,
  RoleAssignment,
  PermissionCheckResult,
  RoleHierarchyNode,
} from "./types";

export {
  RoleLevel,
  ALL_ROLES,
  ALL_PERMISSIONS,
  ROLE_DIRECT_PERMISSIONS,
} from "./types";

// Hierarchy
export {
  getInheritedRoles,
  getRolesInheritingFrom,
  getEffectivePermissions,
  roleHasPermission,
  minimumRoleFor,
  roleAtLeast,
  buildHierarchy,
} from "./RoleHierarchy";

// Registry
export { RoleRegistry, RbacError } from "./RoleRegistry";

// Guard
export { PermissionGuard } from "./PermissionGuard";

// ── Factory ───────────────────────────────────────────────────────────────────

import { RoleRegistry } from "./RoleRegistry";
import { PermissionGuard } from "./PermissionGuard";
import type { SecurityEventEmitter } from "../security/SecurityEventEmitter";

export interface RbacContext {
  registry: RoleRegistry;
  guard: PermissionGuard;
}

/**
 * Create a fully-wired RBAC context.
 *
 * @param superAdminAddress - The on-chain admin address to bootstrap as SuperAdmin.
 * @param emitter           - Optional security event emitter for audit logging.
 * @param storageKey        - sessionStorage key for persisting assignments.
 */
export function createRbac(
  superAdminAddress: string,
  emitter?: SecurityEventEmitter | null,
  storageKey?: string,
): RbacContext {
  const registry = new RoleRegistry({ storageKey, emitter });
  registry.bootstrapSuperAdmin(superAdminAddress);
  const guard = new PermissionGuard(registry);
  return { registry, guard };
}
