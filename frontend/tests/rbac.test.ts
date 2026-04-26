/**
 * RBAC system tests
 *
 * Covers:
 * - RoleHierarchy: inheritance, permission resolution, minimum role
 * - RoleRegistry: grant, revoke, bootstrap, permission checks, storage
 * - PermissionGuard: protect, protectSync, can, permissionMap
 * - createRbac factory
 * - RbacError
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getInheritedRoles,
  getRolesInheritingFrom,
  getEffectivePermissions,
  roleHasPermission,
  minimumRoleFor,
  roleAtLeast,
  buildHierarchy,
  RoleRegistry,
  PermissionGuard,
  RbacError,
  createRbac,
  ALL_ROLES,
  ALL_PERMISSIONS,
  ROLE_DIRECT_PERMISSIONS,
  RoleLevel,
} from "../rbac";
import type { Role, Permission } from "../rbac/types";

// ── Addresses ─────────────────────────────────────────────────────────────────

const SUPER = "GSUPER000000000000000000000000000000000000000000000000000";
const CONFIG = "GCONFIG00000000000000000000000000000000000000000000000000";
const PAUSE = "GPAUSE000000000000000000000000000000000000000000000000000";
const NOBODY = "GNOBODY00000000000000000000000000000000000000000000000000";

// ── RoleHierarchy ─────────────────────────────────────────────────────────────

describe("RoleHierarchy", () => {
  describe("getInheritedRoles", () => {
    it("SuperAdmin inherits ConfigAdmin and PauseAdmin", () => {
      const inherited = getInheritedRoles("SuperAdmin");
      expect(inherited).toContain("ConfigAdmin");
      expect(inherited).toContain("PauseAdmin");
      expect(inherited).not.toContain("SuperAdmin");
    });

    it("ConfigAdmin inherits PauseAdmin only", () => {
      const inherited = getInheritedRoles("ConfigAdmin");
      expect(inherited).toEqual(["PauseAdmin"]);
    });

    it("PauseAdmin inherits nothing", () => {
      expect(getInheritedRoles("PauseAdmin")).toEqual([]);
    });
  });

  describe("getRolesInheritingFrom", () => {
    it("PauseAdmin is inherited by ConfigAdmin and SuperAdmin", () => {
      const above = getRolesInheritingFrom("PauseAdmin");
      expect(above).toContain("ConfigAdmin");
      expect(above).toContain("SuperAdmin");
    });

    it("ConfigAdmin is inherited by SuperAdmin only", () => {
      expect(getRolesInheritingFrom("ConfigAdmin")).toEqual(["SuperAdmin"]);
    });

    it("SuperAdmin is inherited by nobody", () => {
      expect(getRolesInheritingFrom("SuperAdmin")).toEqual([]);
    });
  });

  describe("getEffectivePermissions", () => {
    it("PauseAdmin has contract:pause and contract:read", () => {
      const perms = getEffectivePermissions("PauseAdmin");
      expect(perms).toContain("contract:pause");
      expect(perms).toContain("contract:read");
    });

    it("ConfigAdmin has PauseAdmin permissions plus its own", () => {
      const perms = getEffectivePermissions("ConfigAdmin");
      // Inherited from PauseAdmin
      expect(perms).toContain("contract:pause");
      expect(perms).toContain("contract:read");
      // Direct ConfigAdmin permissions
      expect(perms).toContain("fee:update");
      expect(perms).toContain("wager:update");
      expect(perms).toContain("multiplier:update");
      expect(perms).toContain("audit:read");
    });

    it("SuperAdmin has every permission", () => {
      const perms = getEffectivePermissions("SuperAdmin");
      for (const p of ALL_PERMISSIONS) {
        expect(perms).toContain(p);
      }
    });

    it("no duplicate permissions", () => {
      for (const role of ALL_ROLES) {
        const perms = getEffectivePermissions(role);
        expect(new Set(perms).size).toBe(perms.length);
      }
    });
  });

  describe("roleHasPermission", () => {
    it("PauseAdmin has contract:pause", () => {
      expect(roleHasPermission("PauseAdmin", "contract:pause")).toBe(true);
    });

    it("PauseAdmin does not have fee:update", () => {
      expect(roleHasPermission("PauseAdmin", "fee:update")).toBe(false);
    });

    it("ConfigAdmin has fee:update", () => {
      expect(roleHasPermission("ConfigAdmin", "fee:update")).toBe(true);
    });

    it("ConfigAdmin does not have treasury:update", () => {
      expect(roleHasPermission("ConfigAdmin", "treasury:update")).toBe(false);
    });

    it("SuperAdmin has treasury:update", () => {
      expect(roleHasPermission("SuperAdmin", "treasury:update")).toBe(true);
    });

    it("SuperAdmin has role:grant", () => {
      expect(roleHasPermission("SuperAdmin", "role:grant")).toBe(true);
    });
  });

  describe("minimumRoleFor", () => {
    it("contract:pause minimum is PauseAdmin", () => {
      expect(minimumRoleFor("contract:pause")).toBe("PauseAdmin");
    });

    it("fee:update minimum is ConfigAdmin", () => {
      expect(minimumRoleFor("fee:update")).toBe("ConfigAdmin");
    });

    it("treasury:update minimum is SuperAdmin", () => {
      expect(minimumRoleFor("treasury:update")).toBe("SuperAdmin");
    });

    it("role:grant minimum is SuperAdmin", () => {
      expect(minimumRoleFor("role:grant")).toBe("SuperAdmin");
    });
  });

  describe("roleAtLeast", () => {
    it("SuperAdmin is at least SuperAdmin", () => {
      expect(roleAtLeast("SuperAdmin", "SuperAdmin")).toBe(true);
    });

    it("SuperAdmin is at least ConfigAdmin", () => {
      expect(roleAtLeast("SuperAdmin", "ConfigAdmin")).toBe(true);
    });

    it("SuperAdmin is at least PauseAdmin", () => {
      expect(roleAtLeast("SuperAdmin", "PauseAdmin")).toBe(true);
    });

    it("ConfigAdmin is at least PauseAdmin", () => {
      expect(roleAtLeast("ConfigAdmin", "PauseAdmin")).toBe(true);
    });

    it("ConfigAdmin is NOT at least SuperAdmin", () => {
      expect(roleAtLeast("ConfigAdmin", "SuperAdmin")).toBe(false);
    });

    it("PauseAdmin is NOT at least ConfigAdmin", () => {
      expect(roleAtLeast("PauseAdmin", "ConfigAdmin")).toBe(false);
    });
  });

  describe("buildHierarchy", () => {
    it("returns a node for every role", () => {
      const h = buildHierarchy();
      for (const role of ALL_ROLES) {
        expect(h[role]).toBeDefined();
      }
    });

    it("SuperAdmin node has all permissions", () => {
      const h = buildHierarchy();
      for (const p of ALL_PERMISSIONS) {
        expect(h.SuperAdmin.effectivePermissions).toContain(p);
      }
    });

    it("PauseAdmin node has no inherited roles", () => {
      const h = buildHierarchy();
      expect(h.PauseAdmin.inheritsFrom).toHaveLength(0);
    });
  });

  describe("RoleLevel ordering", () => {
    it("PauseAdmin < ConfigAdmin < SuperAdmin", () => {
      expect(RoleLevel.PauseAdmin).toBeLessThan(RoleLevel.ConfigAdmin);
      expect(RoleLevel.ConfigAdmin).toBeLessThan(RoleLevel.SuperAdmin);
    });
  });
});

// ── RoleRegistry ──────────────────────────────────────────────────────────────

describe("RoleRegistry", () => {
  let registry: RoleRegistry;

  beforeEach(() => {
    registry = new RoleRegistry({ storageKey: `test-rbac-${Math.random()}` });
    registry.bootstrapSuperAdmin(SUPER);
  });

  describe("bootstrapSuperAdmin", () => {
    it("assigns SuperAdmin to the bootstrapped address", () => {
      expect(registry.getRoleOf(SUPER)).toBe("SuperAdmin");
    });

    it("is idempotent", () => {
      registry.bootstrapSuperAdmin(SUPER);
      expect(
        registry.listAssignments().filter((a) => a.address === SUPER),
      ).toHaveLength(1);
    });
  });

  describe("grantRole", () => {
    it("SuperAdmin can grant ConfigAdmin", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      expect(registry.getRoleOf(CONFIG)).toBe("ConfigAdmin");
    });

    it("SuperAdmin can grant PauseAdmin", () => {
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      expect(registry.getRoleOf(PAUSE)).toBe("PauseAdmin");
    });

    it("non-SuperAdmin cannot grant roles", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      expect(() => registry.grantRole(CONFIG, PAUSE, "PauseAdmin")).toThrow(
        RbacError,
      );
    });

    it("stores grantedBy and grantedAt", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin", "ops team");
      const a = registry.getAssignment(CONFIG)!;
      expect(a.grantedBy).toBe(SUPER);
      expect(a.label).toBe("ops team");
      expect(a.grantedAt).toBeTruthy();
    });

    it("replaces an existing role on re-grant", () => {
      registry.grantRole(SUPER, CONFIG, "PauseAdmin");
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      expect(registry.getRoleOf(CONFIG)).toBe("ConfigAdmin");
    });
  });

  describe("revokeRole", () => {
    it("SuperAdmin can revoke a role", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      registry.revokeRole(SUPER, CONFIG);
      expect(registry.getRoleOf(CONFIG)).toBeNull();
    });

    it("non-SuperAdmin cannot revoke roles", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      expect(() => registry.revokeRole(CONFIG, PAUSE)).toThrow(RbacError);
    });

    it("revoking a non-existent role is a no-op", () => {
      expect(() => registry.revokeRole(SUPER, NOBODY)).not.toThrow();
    });
  });

  describe("getRoleOf / getAssignment", () => {
    it("returns null for unknown address", () => {
      expect(registry.getRoleOf(NOBODY)).toBeNull();
      expect(registry.getAssignment(NOBODY)).toBeNull();
    });
  });

  describe("listAssignments / getAddressesWithRole", () => {
    it("listAssignments returns all assignments", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      expect(registry.listAssignments()).toHaveLength(3); // SUPER + CONFIG + PAUSE
    });

    it("getAddressesWithRole filters by exact role", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      const configAdmins = registry.getAddressesWithRole("ConfigAdmin");
      expect(configAdmins).toHaveLength(1);
      expect(configAdmins[0].address).toBe(CONFIG);
    });
  });

  describe("checkPermission", () => {
    it("returns granted=true for a valid permission", () => {
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      const result = registry.checkPermission(PAUSE, "contract:pause");
      expect(result.granted).toBe(true);
      expect(result.grantingRole).toBe("PauseAdmin");
    });

    it("returns granted=false for an insufficient role", () => {
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      const result = registry.checkPermission(PAUSE, "fee:update");
      expect(result.granted).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it("returns granted=false for no role", () => {
      const result = registry.checkPermission(NOBODY, "contract:read");
      expect(result.granted).toBe(false);
      expect(result.reason).toMatch(/No role/);
    });
  });

  describe("hasPermission", () => {
    it("returns true for SuperAdmin on any permission", () => {
      for (const p of ALL_PERMISSIONS) {
        expect(registry.hasPermission(SUPER, p)).toBe(true);
      }
    });

    it("returns false for unknown address", () => {
      expect(registry.hasPermission(NOBODY, "contract:read")).toBe(false);
    });
  });

  describe("assertPermission", () => {
    it("does not throw when permission is granted", () => {
      expect(() =>
        registry.assertPermission(SUPER, "treasury:update"),
      ).not.toThrow();
    });

    it("throws RbacError when permission is denied", () => {
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      expect(() => registry.assertPermission(PAUSE, "fee:update")).toThrow(
        RbacError,
      );
    });

    it("throws RbacError for unknown address", () => {
      expect(() => registry.assertPermission(NOBODY, "contract:read")).toThrow(
        RbacError,
      );
    });
  });

  describe("getPermissionsOf", () => {
    it("returns empty array for unknown address", () => {
      expect(registry.getPermissionsOf(NOBODY)).toEqual([]);
    });

    it("returns all permissions for SuperAdmin", () => {
      const perms = registry.getPermissionsOf(SUPER);
      for (const p of ALL_PERMISSIONS) {
        expect(perms).toContain(p);
      }
    });

    it("returns only PauseAdmin permissions for PauseAdmin", () => {
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      const perms = registry.getPermissionsOf(PAUSE);
      expect(perms).toContain("contract:pause");
      expect(perms).not.toContain("fee:update");
    });
  });

  describe("hasAtLeastRole", () => {
    it("SuperAdmin has at least every role", () => {
      for (const role of ALL_ROLES) {
        expect(registry.hasAtLeastRole(SUPER, role)).toBe(true);
      }
    });

    it("PauseAdmin does not have at least ConfigAdmin", () => {
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      expect(registry.hasAtLeastRole(PAUSE, "ConfigAdmin")).toBe(false);
    });

    it("unknown address has no role", () => {
      expect(registry.hasAtLeastRole(NOBODY, "PauseAdmin")).toBe(false);
    });
  });

  describe("role upgrade / downgrade", () => {
    it("upgrading PauseAdmin to ConfigAdmin grants additional permissions", () => {
      registry.grantRole(SUPER, PAUSE, "PauseAdmin");
      expect(registry.hasPermission(PAUSE, "fee:update")).toBe(false);

      registry.grantRole(SUPER, PAUSE, "ConfigAdmin");
      expect(registry.hasPermission(PAUSE, "fee:update")).toBe(true);
    });

    it("revoking a role removes all permissions", () => {
      registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
      expect(registry.hasPermission(CONFIG, "fee:update")).toBe(true);

      registry.revokeRole(SUPER, CONFIG);
      expect(registry.hasPermission(CONFIG, "fee:update")).toBe(false);
    });
  });

  describe("audit emitter integration", () => {
    it("calls emitter.emit on grantRole", async () => {
      const emitter = { emit: vi.fn().mockResolvedValue({}) } as never;
      const reg = new RoleRegistry({
        storageKey: `test-rbac-emit-${Math.random()}`,
        emitter,
      });
      reg.bootstrapSuperAdmin(SUPER);
      reg.grantRole(SUPER, CONFIG, "ConfigAdmin");
      // Allow microtask queue to flush
      await Promise.resolve();
      expect(emitter.emit).toHaveBeenCalledWith(
        "role.granted",
        "authorization",
        "info",
        SUPER,
        expect.objectContaining({ targetAddress: CONFIG, role: "ConfigAdmin" }),
      );
    });

    it("calls emitter.emit on revokeRole", async () => {
      const emitter = { emit: vi.fn().mockResolvedValue({}) } as never;
      const reg = new RoleRegistry({
        storageKey: `test-rbac-emit2-${Math.random()}`,
        emitter,
      });
      reg.bootstrapSuperAdmin(SUPER);
      reg.grantRole(SUPER, CONFIG, "ConfigAdmin");
      reg.revokeRole(SUPER, CONFIG);
      await Promise.resolve();
      expect(emitter.emit).toHaveBeenCalledWith(
        "role.revoked",
        "authorization",
        "info",
        SUPER,
        expect.objectContaining({ targetAddress: CONFIG }),
      );
    });

    it("calls emitter.emitAccessDenied on assertPermission failure", async () => {
      const emitter = {
        emit: vi.fn().mockResolvedValue({}),
        emitAccessDenied: vi.fn().mockResolvedValue({}),
      } as never;
      const reg = new RoleRegistry({
        storageKey: `test-rbac-emit3-${Math.random()}`,
        emitter,
      });
      reg.bootstrapSuperAdmin(SUPER);
      reg.grantRole(SUPER, PAUSE, "PauseAdmin");

      expect(() => reg.assertPermission(PAUSE, "fee:update")).toThrow(
        RbacError,
      );
      await Promise.resolve();
      expect(emitter.emitAccessDenied).toHaveBeenCalledWith(
        PAUSE,
        "fee",
        "update",
        expect.any(String),
      );
    });
  });
});

// ── PermissionGuard ───────────────────────────────────────────────────────────

describe("PermissionGuard", () => {
  let registry: RoleRegistry;
  let guard: PermissionGuard;

  beforeEach(() => {
    registry = new RoleRegistry({ storageKey: `test-guard-${Math.random()}` });
    registry.bootstrapSuperAdmin(SUPER);
    registry.grantRole(SUPER, CONFIG, "ConfigAdmin");
    registry.grantRole(SUPER, PAUSE, "PauseAdmin");
    guard = new PermissionGuard(registry);
  });

  describe("protect", () => {
    it("executes fn when permission is granted", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await guard.protect("fee:update", CONFIG, fn);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledOnce();
    });

    it("throws and does not call fn when permission is denied", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      await expect(guard.protect("fee:update", PAUSE, fn)).rejects.toThrow(
        RbacError,
      );
      expect(fn).not.toHaveBeenCalled();
    });

    it("throws for unknown address", async () => {
      const fn = vi.fn();
      await expect(guard.protect("contract:read", NOBODY, fn)).rejects.toThrow(
        RbacError,
      );
    });
  });

  describe("protectSync", () => {
    it("executes fn when permission is granted", () => {
      const fn = vi.fn().mockReturnValue(42);
      const result = guard.protectSync("contract:pause", PAUSE, fn);
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledOnce();
    });

    it("throws and does not call fn when permission is denied", () => {
      const fn = vi.fn();
      expect(() => guard.protectSync("treasury:update", CONFIG, fn)).toThrow(
        RbacError,
      );
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("can", () => {
    it("returns true for a granted permission", () => {
      expect(guard.can("fee:update", CONFIG)).toBe(true);
    });

    it("returns false for a denied permission", () => {
      expect(guard.can("treasury:update", CONFIG)).toBe(false);
    });

    it("returns false for unknown address", () => {
      expect(guard.can("contract:read", NOBODY)).toBe(false);
    });
  });

  describe("permissionMap", () => {
    it("returns correct map for ConfigAdmin", () => {
      const map = guard.permissionMap(CONFIG, [
        "fee:update",
        "treasury:update",
        "contract:pause",
      ]);
      expect(map["fee:update"]).toBe(true);
      expect(map["treasury:update"]).toBe(false);
      expect(map["contract:pause"]).toBe(true); // inherited from PauseAdmin
    });

    it("returns all false for unknown address", () => {
      const map = guard.permissionMap(NOBODY, ["fee:update", "contract:pause"]);
      expect(map["fee:update"]).toBe(false);
      expect(map["contract:pause"]).toBe(false);
    });
  });
});

// ── createRbac factory ────────────────────────────────────────────────────────

describe("createRbac", () => {
  it("returns registry and guard", () => {
    const { registry, guard } = createRbac(SUPER);
    expect(registry).toBeDefined();
    expect(guard).toBeDefined();
  });

  it("bootstraps SuperAdmin", () => {
    const { registry } = createRbac(SUPER);
    expect(registry.getRoleOf(SUPER)).toBe("SuperAdmin");
  });

  it("guard can check permissions immediately", () => {
    const { guard } = createRbac(SUPER);
    expect(guard.can("treasury:update", SUPER)).toBe(true);
    expect(guard.can("treasury:update", NOBODY)).toBe(false);
  });
});

// ── RbacError ─────────────────────────────────────────────────────────────────

describe("RbacError", () => {
  it("has name RbacError", () => {
    const err = new RbacError("msg", NOBODY, "fee:update", "no role");
    expect(err.name).toBe("RbacError");
  });

  it("exposes address, permission, reason", () => {
    const err = new RbacError("msg", NOBODY, "fee:update", "no role");
    expect(err.address).toBe(NOBODY);
    expect(err.permission).toBe("fee:update");
    expect(err.reason).toBe("no role");
  });

  it("is instanceof Error", () => {
    const err = new RbacError("msg", NOBODY, undefined, undefined);
    expect(err instanceof Error).toBe(true);
  });
});

// ── ROLE_DIRECT_PERMISSIONS completeness ─────────────────────────────────────

describe("ROLE_DIRECT_PERMISSIONS completeness", () => {
  it("every permission is assigned to at least one role", () => {
    const assigned = new Set(Object.values(ROLE_DIRECT_PERMISSIONS).flat());
    for (const p of ALL_PERMISSIONS) {
      expect(assigned.has(p)).toBe(true);
    }
  });

  it("no permission is assigned to more than one role directly", () => {
    const seen = new Map<Permission, Role>();
    for (const role of ALL_ROLES) {
      for (const p of ROLE_DIRECT_PERMISSIONS[role]) {
        expect(seen.has(p)).toBe(false);
        seen.set(p, role);
      }
    }
  });
});
