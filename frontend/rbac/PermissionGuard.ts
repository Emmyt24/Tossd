/**
 * Permission Guard
 *
 * Middleware-style wrappers that enforce RBAC checks before executing
 * operations. Use these to protect any function that requires a specific
 * permission without scattering `assertPermission` calls everywhere.
 *
 * ## Usage
 *
 * ```ts
 * const guard = new PermissionGuard(registry);
 *
 * // Wrap an async operation
 * const result = await guard.protect(
 *   "fee:update",
 *   callerAddress,
 *   () => contract.setFee(newFee),
 * );
 *
 * // Wrap a synchronous operation
 * guard.protectSync("contract:pause", callerAddress, () => {
 *   setPaused(true);
 * });
 * ```
 */

import { Permission } from "./types";
import { RoleRegistry } from "./RoleRegistry";

export class PermissionGuard {
  constructor(private readonly registry: RoleRegistry) {}

  /**
   * Assert `address` has `permission`, then execute `fn`.
   * Throws `RbacError` if the check fails (fn is never called).
   */
  async protect<T>(
    permission: Permission,
    address: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    this.registry.assertPermission(address, permission);
    return fn();
  }

  /**
   * Synchronous variant of `protect`.
   */
  protectSync<T>(permission: Permission, address: string, fn: () => T): T {
    this.registry.assertPermission(address, permission);
    return fn();
  }

  /**
   * Returns true if `address` has `permission` without throwing.
   * Useful for conditional rendering.
   */
  can(permission: Permission, address: string): boolean {
    return this.registry.hasPermission(address, permission);
  }

  /**
   * Returns a map of permission → boolean for a given address.
   * Useful for building permission-aware UIs.
   */
  permissionMap(
    address: string,
    permissions: Permission[],
  ): Record<Permission, boolean> {
    return Object.fromEntries(
      permissions.map((p) => [p, this.registry.hasPermission(address, p)]),
    ) as Record<Permission, boolean>;
  }
}
