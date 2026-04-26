/**
 * RbacDashboard
 *
 * Role management panel showing:
 * - Current user's role
 * - Full role hierarchy with permissions per tier
 * - All active role assignments with revoke action
 * - Grant role form (SuperAdmin only)
 */

import React, { useState } from "react";
import styles from "./RbacDashboard.module.css";
import { RoleBadge } from "./RoleBadge";
import {
  ALL_ROLES,
  buildHierarchy,
  ROLE_DIRECT_PERMISSIONS,
  getEffectivePermissions,
} from "../rbac";
import type { Role, Permission, RoleAssignment } from "../rbac/types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RbacDashboardProps {
  /** The connected wallet address. */
  currentAddress: string | null;
  /** The current user's role. */
  currentRole: Role | null;
  /** All active role assignments. */
  assignments: RoleAssignment[];
  /** Whether the current user can grant roles. */
  canGrant: boolean;
  /** Whether the current user can revoke roles. */
  canRevoke: boolean;
  /** Callback to grant a role. */
  onGrant(targetAddress: string, role: Role): void;
  /** Callback to revoke a role. */
  onRevoke(targetAddress: string): void;
  /** Last error message (null if none). */
  error: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RbacDashboard({
  currentAddress,
  currentRole,
  assignments,
  canGrant,
  canRevoke,
  onGrant,
  onRevoke,
  error,
}: RbacDashboardProps) {
  const hierarchy = buildHierarchy();

  return (
    <div
      className={styles.dashboard}
      role="region"
      aria-label="Role management"
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Role Management</h2>
        <div className={styles.currentRole}>
          <span>Your role:</span>
          <RoleBadge role={currentRole} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {/* Role hierarchy */}
      <section className={styles.section} aria-label="Role hierarchy">
        <h3 className={styles.sectionTitle}>Role hierarchy</h3>
        <div className={styles.hierarchyGrid}>
          {[...ALL_ROLES].reverse().map((role) => {
            const node = hierarchy[role];
            const directPerms = ROLE_DIRECT_PERMISSIONS[role];
            const effectivePerms = getEffectivePermissions(role);
            const inheritedPerms = effectivePerms.filter(
              (p) => !directPerms.includes(p),
            );

            return (
              <div key={role} className={styles.hierarchyCard}>
                <h4 className={styles.hierarchyCardTitle}>
                  <RoleBadge role={role} />
                </h4>
                <span className={styles.hierarchyCardLevel}>
                  Level {node.level} · inherits{" "}
                  {node.inheritsFrom.length > 0
                    ? node.inheritsFrom.join(", ")
                    : "nothing"}
                </span>
                <ul
                  className={styles.permList}
                  aria-label={`${role} permissions`}
                >
                  {directPerms.map((p) => (
                    <PermItem key={p} permission={p} direct />
                  ))}
                  {inheritedPerms.map((p) => (
                    <PermItem key={p} permission={p} direct={false} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active assignments */}
      <section className={styles.section} aria-label="Active role assignments">
        <h3 className={styles.sectionTitle}>
          Active assignments ({assignments.length})
        </h3>
        {assignments.length === 0 ? (
          <p className={styles.empty}>No role assignments yet.</p>
        ) : (
          <table className={styles.assignmentTable}>
            <thead>
              <tr>
                <th scope="col">Address</th>
                <th scope="col">Role</th>
                <th scope="col">Label</th>
                <th scope="col">Granted by</th>
                <th scope="col">Granted at</th>
                {canRevoke && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <AssignmentRow
                  key={a.address}
                  assignment={a}
                  currentAddress={currentAddress}
                  canRevoke={canRevoke}
                  onRevoke={onRevoke}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Grant form */}
      {canGrant && (
        <section className={styles.section} aria-label="Grant role">
          <h3 className={styles.sectionTitle}>Grant role</h3>
          <GrantForm onGrant={onGrant} />
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PermItem({
  permission,
  direct,
}: {
  permission: Permission;
  direct: boolean;
}) {
  return (
    <li
      className={`${styles.permItem} ${direct ? styles.permItemDirect : ""}`}
      title={direct ? "Direct permission" : "Inherited permission"}
    >
      <span className={styles.permDot} aria-hidden="true" />
      {permission}
      {!direct && (
        <span className={styles.inheritedLabel} aria-label="inherited">
          ↑
        </span>
      )}
    </li>
  );
}

function AssignmentRow({
  assignment,
  currentAddress,
  canRevoke,
  onRevoke,
}: {
  assignment: RoleAssignment;
  currentAddress: string | null;
  canRevoke: boolean;
  onRevoke(address: string): void;
}) {
  const isSelf = assignment.address === currentAddress;

  return (
    <tr>
      <td className={styles.addressCell} title={assignment.address}>
        {truncate(assignment.address)}
        {isSelf && <span aria-label=" (you)"> (you)</span>}
      </td>
      <td>
        <RoleBadge role={assignment.role} />
      </td>
      <td className={styles.labelCell}>{assignment.label ?? "—"}</td>
      <td className={styles.grantedByCell} title={assignment.grantedBy}>
        {truncate(assignment.grantedBy)}
      </td>
      <td className={styles.labelCell}>
        {new Date(assignment.grantedAt).toLocaleString()}
      </td>
      {canRevoke && (
        <td>
          {!isSelf && (
            <button
              className={styles.revokeBtn}
              onClick={() => onRevoke(assignment.address)}
              aria-label={`Revoke role from ${truncate(assignment.address)}`}
            >
              Revoke
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function GrantForm({
  onGrant,
}: {
  onGrant(targetAddress: string, role: Role): void;
}) {
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<Role>("PauseAdmin");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    onGrant(address.trim(), role);
    setAddress("");
  };

  return (
    <form className={styles.grantForm} onSubmit={handleSubmit} noValidate>
      <input
        className={styles.grantInput}
        type="text"
        placeholder="G... (Stellar address)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        aria-label="Target wallet address"
        maxLength={56}
        required
      />
      <select
        className={styles.grantSelect}
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        aria-label="Role to grant"
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className={styles.grantBtn}
        disabled={!address.trim()}
      >
        Grant role
      </button>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(addr: string): string {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + "…" + addr.slice(-4);
}
