/**
 * RoleBadge — compact role indicator pill.
 * Renders a colour-coded badge for a given role (or "No role").
 */

import React from "react";
import styles from "./RoleBadge.module.css";
import type { Role } from "../rbac/types";

interface RoleBadgeProps {
  role: Role | null;
  className?: string;
}

const ROLE_LABELS: Record<Role, string> = {
  SuperAdmin: "Super Admin",
  ConfigAdmin: "Config Admin",
  PauseAdmin: "Pause Admin",
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const cls = role ? styles[role] : styles.none;
  const label = role ? ROLE_LABELS[role] : "No role";

  return (
    <span
      className={`${styles.badge} ${cls} ${className ?? ""}`}
      aria-label={`Role: ${label}`}
    >
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
