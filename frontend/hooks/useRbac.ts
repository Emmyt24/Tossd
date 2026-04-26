/**
 * useRbac — React hook for RBAC context lifecycle.
 *
 * Initialises the registry with the connected wallet as SuperAdmin,
 * exposes permission checks for conditional rendering, and provides
 * role management actions.
 *
 * ## Usage
 * ```tsx
 * const { can, registry, guard, grantRole, revokeRole } = useRbac({
 *   superAdminAddress: walletAddress,
 *   emitter,
 * });
 *
 * // Conditional rendering
 * {can("fee:update") && <FeeForm />}
 *
 * // Imperative check
 * guard.protect("treasury:update", walletAddress, () => updateTreasury(addr));
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRbac,
  RoleRegistry,
  PermissionGuard,
  RbacError,
  RoleAssignment,
} from "../rbac";
import type { Role, Permission } from "../rbac/types";
import type { SecurityEventEmitter } from "../security/SecurityEventEmitter";

// ── Hook options ──────────────────────────────────────────────────────────────

export interface UseRbacOptions {
  /** The wallet address to bootstrap as SuperAdmin. */
  superAdminAddress: string | null;
  /** Optional security event emitter for audit logging. */
  emitter?: SecurityEventEmitter | null;
  /** sessionStorage key for persisting assignments. */
  storageKey?: string;
}

// ── Hook result ───────────────────────────────────────────────────────────────

export interface UseRbacResult {
  /** The role registry. */
  registry: RoleRegistry | null;
  /** The permission guard. */
  guard: PermissionGuard | null;
  /** True once the registry is initialised. */
  ready: boolean;
  /** The role of the connected wallet (null if none). */
  currentRole: Role | null;
  /** All current role assignments. */
  assignments: RoleAssignment[];
  /** Check if the connected wallet has a permission. */
  can(permission: Permission): boolean;
  /** Check if a specific address has a permission. */
  canAddress(address: string, permission: Permission): boolean;
  /** Grant a role to an address (caller must be SuperAdmin). */
  grantRole(targetAddress: string, role: Role, label?: string): void;
  /** Revoke the role of an address (caller must be SuperAdmin). */
  revokeRole(targetAddress: string): void;
  /** Last RBAC error (cleared on next successful operation). */
  error: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRbac({
  superAdminAddress,
  emitter,
  storageKey,
}: UseRbacOptions): UseRbacResult {
  const registryRef = useRef<RoleRegistry | null>(null);
  const guardRef = useRef<PermissionGuard | null>(null);

  const [ready, setReady] = useState(false);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialise / re-initialise when superAdminAddress changes
  useEffect(() => {
    if (!superAdminAddress) {
      registryRef.current = null;
      guardRef.current = null;
      setReady(false);
      setAssignments([]);
      return;
    }

    const { registry, guard } = createRbac(
      superAdminAddress,
      emitter,
      storageKey,
    );

    registryRef.current = registry;
    guardRef.current = guard;
    setAssignments(registry.listAssignments());
    setReady(true);
    setError(null);
  }, [superAdminAddress, storageKey]); // emitter intentionally omitted — stable ref

  // Keep emitter in sync without re-initialising
  useEffect(() => {
    registryRef.current?.setEmitter(emitter ?? null);
  }, [emitter]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const currentRole = useMemo<Role | null>(() => {
    if (!superAdminAddress || !registryRef.current) return null;
    return registryRef.current.getRoleOf(superAdminAddress);
  }, [superAdminAddress, assignments]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!superAdminAddress || !registryRef.current) return false;
      return registryRef.current.hasPermission(superAdminAddress, permission);
    },
    [superAdminAddress, assignments], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const canAddress = useCallback(
    (address: string, permission: Permission): boolean => {
      if (!registryRef.current) return false;
      return registryRef.current.hasPermission(address, permission);
    },
    [assignments], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const grantRole = useCallback(
    (targetAddress: string, role: Role, label?: string): void => {
      if (!superAdminAddress || !registryRef.current) return;
      try {
        registryRef.current.grantRole(
          superAdminAddress,
          targetAddress,
          role,
          label,
        );
        setAssignments(registryRef.current.listAssignments());
        setError(null);
      } catch (err) {
        setError(err instanceof RbacError ? err.message : String(err));
      }
    },
    [superAdminAddress],
  );

  const revokeRole = useCallback(
    (targetAddress: string): void => {
      if (!superAdminAddress || !registryRef.current) return;
      try {
        registryRef.current.revokeRole(superAdminAddress, targetAddress);
        setAssignments(registryRef.current.listAssignments());
        setError(null);
      } catch (err) {
        setError(err instanceof RbacError ? err.message : String(err));
      }
    },
    [superAdminAddress],
  );

  return {
    registry: registryRef.current,
    guard: guardRef.current,
    ready,
    currentRole,
    assignments,
    can,
    canAddress,
    grantRole,
    revokeRole,
    error,
  };
}
