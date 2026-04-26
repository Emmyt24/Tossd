/**
 * Security audit logging — public API barrel
 *
 * Import from this file rather than individual modules.
 *
 * ```ts
 * import { createSecurityLogger, SecurityEventEmitter } from "../security";
 * ```
 */

// Types
export type {
  SecurityEventSeverity,
  SecurityEventCategory,
  SecurityEventBase,
  SecurityEvent,
  SecurityEventFilter,
  SecurityEventAggregation,
  WalletConnectEvent,
  WalletDisconnectEvent,
  SessionStartEvent,
  SessionEndEvent,
  AccessGrantedEvent,
  AccessDeniedEvent,
  KeyGeneratedEvent,
  KeyDeactivatedEvent,
  SigningOperationEvent,
  CommitmentGeneratedEvent,
  GameStartedEvent,
  GameRevealedEvent,
  GameCashedOutEvent,
  GameContinuedEvent,
  HsmFailoverEvent,
  HsmRecoveryEvent,
  ConfigurationChangedEvent,
  ErrorEvent,
  RateLimitExceededEvent,
  SuspiciousPatternEvent,
  CommitmentReplayAttemptEvent,
} from "./types";

// Immutable log
export {
  ImmutableAuditLog,
  GENESIS_HASH,
  computeEventHash,
  computeChainHash,
  canonicalJson,
} from "./ImmutableAuditLog";
export type { ChainVerificationResult } from "./ImmutableAuditLog";

// Emitter
export { SecurityEventEmitter } from "./SecurityEventEmitter";
export type {
  SecurityEventListener,
  RateLimitConfig,
  SecurityEventEmitterOptions,
} from "./SecurityEventEmitter";

// Aggregator
export { SecurityEventAggregator } from "./SecurityEventAggregator";
export type {
  TimeSeriesBucket,
  AnomalyReport,
} from "./SecurityEventAggregator";

// ── Factory ───────────────────────────────────────────────────────────────────

import { ImmutableAuditLog } from "./ImmutableAuditLog";
import { SecurityEventEmitter } from "./SecurityEventEmitter";
import { SecurityEventAggregator } from "./SecurityEventAggregator";
import type { SecurityEventEmitterOptions } from "./SecurityEventEmitter";

export interface SecurityLogger {
  log: ImmutableAuditLog;
  emitter: SecurityEventEmitter;
  aggregator: SecurityEventAggregator;
}

/**
 * Create and initialise a fully-wired security logger.
 *
 * Opens the persistent backend, replays stored events into the in-memory
 * chain, and returns the emitter + aggregator ready to use.
 *
 * ```ts
 * const { emitter, aggregator } = await createSecurityLogger({
 *   sessionId: walletAddress,
 * });
 * await emitter.emitWalletConnect(address, "freighter", pubKey);
 * const stats = aggregator.aggregate();
 * ```
 */
export async function createSecurityLogger(
  options: SecurityEventEmitterOptions & {
    storeName?: string;
    maxEntries?: number;
  } = {},
): Promise<SecurityLogger> {
  const log = new ImmutableAuditLog({
    storeName: options.storeName,
    maxEntries: options.maxEntries,
  });
  await log.open();

  const emitter = new SecurityEventEmitter(log, options);
  const aggregator = new SecurityEventAggregator(log);

  return { log, emitter, aggregator };
}
