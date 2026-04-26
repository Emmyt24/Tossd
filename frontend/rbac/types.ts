/**
 * RBAC type definitions
 *
 * Mirrors the on-chain role hierarchy from the Soroban contract:
 *
 *   SuperAdmin  ──inherits──▶  ConfigAdmin  ──inherits──▶  PauseAdmin
 *
 * Each role inherits all permissions of every role below it in the hierarchy.
 * A SuperAdmin can do everything a ConfigAdmin can, and everything a PauseAdmin
 * can. A PauseAdmin can only pause/unpause.
 *
 * ## Permission taxonomy
 * Permissions are namespaced strings: "<resource>:<action>"
 *
 *   contract:pause          — pause / unpause the contract
 *   contract:read           — read contract config and stats
 *   fee:update              — change the protocol fee
 *   wager:update            — change wager limits
 *   multiplier:update       — change payout multipliers
 *   treasury:update         — change the treasury address (SuperAdmin only)
 *   role:grant              — grant a role to an address (SuperAdmin only)
 *   role:revoke             — revoke a role from an address (SuperAdmin only)
 *   role:read               — read role assignments
 *   hsm:manage              — manage HSM keys
 *   audit:read              — read the security audit log
 *   audit:export            — export the security audit log
 */

// ── Role definitions ──────────────────────────────────────────────────────────

/**
 * Role discriminants — ordered from least to most privileged.
 * The numeric value is used for hierarchy comparisons.
 */
export const RoleLevel = {
  PauseAdmin: 10,
  ConfigAdmin: 20,
  SuperAdmin: 30,
} as const;

export type Role = keyof typeof RoleLevel;

/** All roles in ascending privilege order. */
export const ALL_ROLES: Role[] = ["PauseAdmin", "ConfigAdmin", "SuperAdmin"];

// ── Permission definitions ────────────────────────────────────────────────────

export type Permission =
  | "contract:pause"
  | "contract:read"
  | "fee:update"
  | "wager:update"
  | "multiplier:update"
  | "treasury:update"
  | "role:grant"
  | "role:revoke"
  | "role:read"
  | "hsm:manage"
  | "audit:read"
  | "audit:export";

/** All defined permissions. */
export const ALL_PERMISSIONS: Permission[] = [
  "contract:pause",
  "contract:read",
  "fee:update",
  "wager:update",
  "multiplier:update",
  "treasury:update",
  "role:grant",
  "role:revoke",
  "role:read",
  "hsm:manage",
  "audit:read",
  "audit:export",
];

// ── Role → permission mapping ─────────────────────────────────────────────────

/**
 * Permissions granted directly to each role (not including inherited ones).
 * Use `getEffectivePermissions(role)` to get the full set including inheritance.
 */
export const ROLE_DIRECT_PERMISSIONS: Record<Role, Permission[]> = {
  PauseAdmin: ["contract:pause", "contract:read"],
  ConfigAdmin: [
    "fee:update",
    "wager:update",
    "multiplier:update",
    "role:read",
    "audit:read",
  ],
  SuperAdmin: [
    "treasury:update",
    "role:grant",
    "role:revoke",
    "hsm:manage",
    "audit:export",
  ],
};

// ── Role assignment ───────────────────────────────────────────────────────────

/** A role assignment binding a wallet address to a role. */
export interface RoleAssignment {
  /** Stellar wallet address of the assignee. */
  address: string;
  /** Assigned role. */
  role: Role;
  /** ISO-8601 timestamp when the role was granted. */
  grantedAt: string;
  /** Address of the admin who granted the role. */
  grantedBy: string;
  /** Optional human-readable label for this assignment. */
  label?: string;
}

// ── Permission check result ───────────────────────────────────────────────────

export interface PermissionCheckResult {
  /** Whether the permission is granted. */
  granted: boolean;
  /** The role that grants the permission (undefined if denied). */
  grantingRole?: Role;
  /** The permission that was checked. */
  permission: Permission;
  /** The address that was checked. */
  address: string;
  /** Reason for denial (undefined if granted). */
  reason?: string;
}

// ── Role hierarchy node ───────────────────────────────────────────────────────

export interface RoleHierarchyNode {
  role: Role;
  level: number;
  /** Roles this role inherits from (lower in the hierarchy). */
  inheritsFrom: Role[];
  /** Roles that inherit from this role (higher in the hierarchy). */
  inheritedBy: Role[];
  /** Direct permissions (not including inherited). */
  directPermissions: Permission[];
  /** All effective permissions (including inherited). */
  effectivePermissions: Permission[];
}
