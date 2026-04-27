/**
 * Multi-party authorization + timelock types
 *
 * Models the full proposal lifecycle:
 *
 *   Pending ──(quorum met)──► Queued ──(delay elapsed)──► Ready ──(execute)──► Executed
 *          ──(cancelled)────────────────────────────────────────────────────► Cancelled
 *          ──(expired)──────────────────────────────────────────────────────► Expired
 *
 * ## Timelock delays (configurable, defaults shown)
 *
 *   CRITICAL operations (treasury, role changes)  : 48 h
 *   HIGH     operations (fee, wager limits)        : 24 h
 *   MEDIUM   operations (multipliers, pause)       : 6 h
 *   LOW      operations (read-only, audit export)  : 0 h  (no delay)
 *
 * ## Quorum
 * A proposal is approved when `approvals / totalSigners >= quorumThreshold`.
 * Default quorum threshold: 0.51 (simple majority).
 * Emergency override requires a higher threshold: 0.75.
 */

import type { Permission } from "../rbac/types";

// ── Operation classification ──────────────────────────────────────────────────

export type OperationRisk = "critical" | "high" | "medium" | "low";

/** Default timelock delays in milliseconds per risk level. */
export const DEFAULT_TIMELOCK_MS: Record<OperationRisk, number> = {
  critical: 48 * 60 * 60 * 1000, // 48 h
  high: 24 * 60 * 60 * 1000, // 24 h
  medium: 6 * 60 * 60 * 1000, //  6 h
  low: 0, //  0 h
};

/** Risk classification for each permission. */
export const PERMISSION_RISK: Record<Permission, OperationRisk> = {
  "treasury:update": "critical",
  "role:grant": "critical",
  "role:revoke": "critical",
  "hsm:manage": "critical",
  "fee:update": "high",
  "wager:update": "high",
  "multiplier:update": "medium",
  "contract:pause": "medium",
  "audit:export": "low",
  "audit:read": "low",
  "contract:read": "low",
  "role:read": "low",
};

// ── Proposal action ───────────────────────────────────────────────────────────

/**
 * Typed payload for each supported admin operation.
 * Discriminated by `type` for exhaustive handling.
 */
export type ProposalAction =
  | { type: "set_fee"; feeBps: number }
  | { type: "set_wager_limits"; minWager: number; maxWager: number }
  | {
      type: "set_multipliers";
      streak1: number;
      streak2: number;
      streak3: number;
      streak4Plus: number;
    }
  | { type: "set_treasury"; newTreasury: string }
  | { type: "set_paused"; paused: boolean }
  | { type: "grant_role"; targetAddress: string; role: string; label?: string }
  | { type: "revoke_role"; targetAddress: string }
  | { type: "custom"; description: string; payload: Record<string, unknown> };

/** Map each action type to the permission it requires. */
export const ACTION_PERMISSION: Record<ProposalAction["type"], Permission> = {
  set_fee: "fee:update",
  set_wager_limits: "wager:update",
  set_multipliers: "multiplier:update",
  set_treasury: "treasury:update",
  set_paused: "contract:pause",
  grant_role: "role:grant",
  revoke_role: "role:revoke",
  custom: "audit:export", // highest available as a catch-all
};

// ── Proposal lifecycle ────────────────────────────────────────────────────────

export type ProposalStatus =
  | "pending" // Created, collecting approvals
  | "queued" // Quorum met, timelock counting down
  | "ready" // Timelock elapsed, ready to execute
  | "executed" // Successfully executed
  | "cancelled" // Cancelled by proposer or SuperAdmin
  | "expired"; // Voting window closed without quorum

// ── Approval record ───────────────────────────────────────────────────────────

export interface ApprovalRecord {
  /** Signer address. */
  address: string;
  /** ISO-8601 timestamp of the approval. */
  approvedAt: string;
  /** Optional comment from the signer. */
  comment?: string;
}

export interface RejectionRecord {
  address: string;
  rejectedAt: string;
  reason?: string;
}

// ── Proposal ──────────────────────────────────────────────────────────────────

export interface Proposal {
  /** UUID v4 proposal identifier. */
  id: string;
  /** Address that created the proposal. */
  proposer: string;
  /** The operation to be executed. */
  action: ProposalAction;
  /** Required permission for this action. */
  requiredPermission: Permission;
  /** Risk level (determines timelock delay). */
  risk: OperationRisk;
  /** Current lifecycle status. */
  status: ProposalStatus;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 deadline for collecting approvals. */
  votingDeadline: string;
  /** ISO-8601 timestamp when quorum was first reached (null until then). */
  queuedAt: string | null;
  /** ISO-8601 earliest execution time (queuedAt + timelockMs). */
  executeAfter: string | null;
  /** ISO-8601 execution timestamp (null until executed). */
  executedAt: string | null;
  /** Address that executed the proposal (null until executed). */
  executedBy: string | null;
  /** Timelock delay in milliseconds. */
  timelockMs: number;
  /** Minimum approval fraction required (0–1). */
  quorumThreshold: number;
  /** Addresses that have approved. */
  approvals: ApprovalRecord[];
  /** Addresses that have rejected. */
  rejections: RejectionRecord[];
  /** Human-readable description. */
  description: string;
  /** Whether this is an emergency proposal (higher quorum, shorter timelock). */
  emergency: boolean;
}

// ── Multisig config ───────────────────────────────────────────────────────────

export interface MultisigConfig {
  /** Addresses authorised to approve proposals. */
  signers: string[];
  /** Minimum approval fraction for normal proposals (default: 0.51). */
  quorumThreshold: number;
  /** Minimum approval fraction for emergency proposals (default: 0.75). */
  emergencyQuorumThreshold: number;
  /** Voting window in milliseconds (default: 72 h). */
  votingWindowMs: number;
  /** Custom timelock overrides per risk level (falls back to DEFAULT_TIMELOCK_MS). */
  timelockOverrides?: Partial<Record<OperationRisk, number>>;
}

export const DEFAULT_MULTISIG_CONFIG: MultisigConfig = {
  signers: [],
  quorumThreshold: 0.51,
  emergencyQuorumThreshold: 0.75,
  votingWindowMs: 72 * 60 * 60 * 1000, // 72 h
};

// ── Execution result ──────────────────────────────────────────────────────────

export interface ProposalExecutionResult {
  proposalId: string;
  executedAt: string;
  executedBy: string;
  action: ProposalAction;
}

// ── Timelock status ───────────────────────────────────────────────────────────

export interface TimelockStatus {
  proposalId: string;
  timelockMs: number;
  queuedAt: string | null;
  executeAfter: string | null;
  remainingMs: number;
  /** True when the timelock has elapsed and the proposal can be executed. */
  elapsed: boolean;
}
