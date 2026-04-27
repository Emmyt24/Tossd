/**
 * Multisig + timelock module public API
 *
 * ```ts
 * import { createMultisig, ProposalEngine, TimelockClock } from "../multisig";
 * ```
 */

export type {
  OperationRisk,
  ProposalAction,
  ProposalStatus,
  ApprovalRecord,
  RejectionRecord,
  Proposal,
  MultisigConfig,
  ProposalExecutionResult,
  TimelockStatus,
} from "./types";

export {
  DEFAULT_TIMELOCK_MS,
  PERMISSION_RISK,
  ACTION_PERMISSION,
  DEFAULT_MULTISIG_CONFIG,
} from "./types";

export { ProposalEngine, MultisigError } from "./ProposalEngine";
export { TimelockClock } from "./TimelockClock";

// ── Factory ───────────────────────────────────────────────────────────────────

import { ProposalEngine } from "./ProposalEngine";
import { TimelockClock } from "./TimelockClock";
import type { MultisigConfig } from "./types";
import type { SecurityEventEmitter } from "../security/SecurityEventEmitter";
import type { RoleRegistry } from "../rbac/RoleRegistry";

export interface MultisigContext {
  engine: ProposalEngine;
  clock: TimelockClock;
}

/**
 * Create a fully-wired multisig context.
 *
 * @param signers   - Initial list of authorised signer addresses
 * @param config    - Optional config overrides
 * @param emitter   - Optional security event emitter
 * @param registry  - Optional RBAC registry (for SuperAdmin checks)
 */
export function createMultisig(
  signers: string[],
  config?: Partial<MultisigConfig>,
  emitter?: SecurityEventEmitter | null,
  registry?: RoleRegistry | null,
): MultisigContext {
  const engine = new ProposalEngine({
    config: { ...config, signers },
    emitter,
    registry,
  });
  const clock = new TimelockClock(engine);
  return { engine, clock };
}
