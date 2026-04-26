/**
 * Security Event Emitter
 *
 * Central event bus for the security audit logging system. Responsible for:
 *   1. Building fully-formed `SecurityEvent` objects (ID, timestamps, hashes)
 *   2. Appending them to the `ImmutableAuditLog`
 *   3. Dispatching to registered listeners for real-time alerting
 *   4. Enforcing rate limits per actor/operation to detect abuse
 *
 * ## Usage
 * ```ts
 * const log   = new ImmutableAuditLog();
 * const emitter = new SecurityEventEmitter(log, { sessionId: "sess-abc" });
 * await log.open();
 *
 * await emitter.emit("wallet.connect", "authentication", "info", walletAddr, {
 *   walletType: "freighter",
 *   walletAddress: walletAddr,
 *   publicKey: pubKey,
 * });
 * ```
 *
 * ## Listener registration
 * ```ts
 * emitter.onEvent((event) => {
 *   if (event.severity === "critical") alertOps(event);
 * });
 * ```
 */

import {
  SecurityEvent,
  SecurityEventCategory,
  SecurityEventSeverity,
} from "./types";
import {
  ImmutableAuditLog,
  computeEventHash,
  GENESIS_HASH,
} from "./ImmutableAuditLog";
import { randomBytes, bytesToHex } from "../hsm/crypto";

// ── Listener ──────────────────────────────────────────────────────────────────

export type SecurityEventListener = (event: SecurityEvent) => void;

// ── Rate limit config ─────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum events per actor per window. */
  maxEventsPerWindow: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

// ── Emitter options ───────────────────────────────────────────────────────────

export interface SecurityEventEmitterOptions {
  /** Session ID to attach to all emitted events. */
  sessionId?: string;
  /** Client identifier (e.g. browser fingerprint). */
  clientId?: string;
  /** Rate limit configuration (default: 500 events / 60s per actor). */
  rateLimit?: RateLimitConfig;
  /** If true, rate limit violations are emitted as anomaly events (default: true). */
  emitRateLimitEvents?: boolean;
}

// ── Rate limit tracker ────────────────────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

// ── Emitter ───────────────────────────────────────────────────────────────────

export class SecurityEventEmitter {
  private readonly log: ImmutableAuditLog;
  private readonly options: Required<SecurityEventEmitterOptions>;
  private readonly listeners: SecurityEventListener[] = [];
  private readonly rateBuckets = new Map<string, RateLimitBucket>();

  constructor(
    log: ImmutableAuditLog,
    options: SecurityEventEmitterOptions = {},
  ) {
    this.log = log;
    this.options = {
      sessionId: options.sessionId ?? generateSessionId(),
      clientId: options.clientId ?? "",
      rateLimit: options.rateLimit ?? {
        maxEventsPerWindow: 500,
        windowMs: 60_000,
      },
      emitRateLimitEvents: options.emitRateLimitEvents ?? true,
    };
  }

  // ── Listener management ───────────────────────────────────────────────────

  onEvent(listener: SecurityEventListener): void {
    this.listeners.push(listener);
  }

  offEvent(listener: SecurityEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  // ── Core emit ─────────────────────────────────────────────────────────────

  /**
   * Build, hash, append, and dispatch a security event.
   *
   * @param type       - Event type discriminator (e.g. "wallet.connect")
   * @param category   - Event category
   * @param severity   - Event severity
   * @param actor      - Actor who triggered the event
   * @param metadata   - Event-specific payload
   */
  async emit(
    type: string,
    category: SecurityEventCategory,
    severity: SecurityEventSeverity,
    actor: string,
    metadata: Record<string, unknown>,
  ): Promise<SecurityEvent> {
    // Rate limit check
    if (this.isRateLimited(actor)) {
      if (this.options.emitRateLimitEvents) {
        // Emit the rate limit event without going through rate limiting again
        await this.emitRaw("ratelimit.exceeded", "anomaly", "warning", actor, {
          walletAddress: actor,
          operation: type,
          limit: this.options.rateLimit.maxEventsPerWindow,
          actual: this.getBucketCount(actor),
          windowMs: this.options.rateLimit.windowMs,
        });
      }
      // Still emit the original event — rate limiting is advisory here
    }

    return this.emitRaw(type, category, severity, actor, metadata);
  }

  // ── Typed convenience emitters ────────────────────────────────────────────

  async emitWalletConnect(
    walletAddress: string,
    walletType: "freighter" | "albedo" | "xbull" | "rabet",
    publicKey: string,
  ): Promise<SecurityEvent> {
    return this.emit(
      "wallet.connect",
      "authentication",
      "info",
      walletAddress,
      {
        walletType,
        walletAddress,
        publicKey,
      },
    );
  }

  async emitWalletDisconnect(
    walletAddress: string,
    reason: "user" | "timeout" | "error",
  ): Promise<SecurityEvent> {
    return this.emit(
      "wallet.disconnect",
      "authentication",
      "info",
      walletAddress,
      {
        walletAddress,
        reason,
      },
    );
  }

  async emitSessionStart(
    walletAddress: string,
    expiresAt: string,
  ): Promise<SecurityEvent> {
    return this.emit("session.start", "authentication", "info", walletAddress, {
      walletAddress,
      expiresAt,
    });
  }

  async emitSessionEnd(
    walletAddress: string,
    reason: "logout" | "timeout" | "revoked",
    durationMs: number,
  ): Promise<SecurityEvent> {
    return this.emit("session.end", "authentication", "info", walletAddress, {
      walletAddress,
      reason,
      durationMs,
    });
  }

  async emitAccessDenied(
    walletAddress: string,
    resource: string,
    action: string,
    reason: string,
  ): Promise<SecurityEvent> {
    return this.emit(
      "access.denied",
      "authorization",
      "warning",
      walletAddress,
      {
        resource,
        action,
        walletAddress,
        reason,
      },
    );
  }

  async emitKeyGenerated(
    keyId: string,
    algorithm: string,
    usage: string,
    provider: string,
    actor: string,
  ): Promise<SecurityEvent> {
    return this.emit("key.generated", "cryptographic", "info", actor, {
      keyId,
      algorithm,
      usage,
      provider,
    });
  }

  async emitSigningOperation(
    keyId: string,
    operation: string,
    signatureHex: string,
    payloadHash: string,
    actor: string,
  ): Promise<SecurityEvent> {
    return this.emit("signing.operation", "cryptographic", "info", actor, {
      keyId,
      operation,
      signatureHex,
      payloadHash,
    });
  }

  async emitCommitmentGenerated(
    commitmentHash: string,
    context: string,
    actor: string,
    keyId?: string,
  ): Promise<SecurityEvent> {
    return this.emit("commitment.generated", "cryptographic", "info", actor, {
      keyId,
      commitmentHash,
      context,
    });
  }

  async emitGameStarted(
    gameId: string,
    walletAddress: string,
    wagerStroops: number,
    side: "heads" | "tails",
    commitmentHash: string,
    txHash: string,
  ): Promise<SecurityEvent> {
    return this.emit("game.started", "transaction", "info", walletAddress, {
      gameId,
      walletAddress,
      wagerStroops,
      side,
      commitmentHash,
      txHash,
    });
  }

  async emitGameRevealed(
    gameId: string,
    walletAddress: string,
    outcome: "win" | "loss",
    txHash: string,
  ): Promise<SecurityEvent> {
    return this.emit("game.revealed", "transaction", "info", walletAddress, {
      gameId,
      walletAddress,
      outcome,
      txHash,
    });
  }

  async emitGameCashedOut(
    gameId: string,
    walletAddress: string,
    payoutStroops: number,
    txHash: string,
  ): Promise<SecurityEvent> {
    return this.emit("game.cashedout", "transaction", "info", walletAddress, {
      gameId,
      walletAddress,
      payoutStroops,
      txHash,
    });
  }

  async emitHsmFailover(
    failedProvider: string,
    activeProvider: string,
    operation: string,
    reason: string,
  ): Promise<SecurityEvent> {
    return this.emit("hsm.failover", "system", "warning", "system", {
      failedProvider,
      activeProvider,
      operation,
      reason,
    });
  }

  async emitError(
    errorType: string,
    errorMessage: string,
    context: Record<string, unknown>,
    actor = "system",
    stackTrace?: string,
  ): Promise<SecurityEvent> {
    return this.emit("error", "system", "error", actor, {
      errorType,
      errorMessage,
      stackTrace,
      context,
    });
  }

  async emitCommitmentReplay(
    walletAddress: string,
    commitmentHash: string,
    originalGameId: string,
    attemptedGameId: string,
  ): Promise<SecurityEvent> {
    return this.emit(
      "commitment.replay",
      "anomaly",
      "critical",
      walletAddress,
      {
        walletAddress,
        commitmentHash,
        originalGameId,
        attemptedGameId,
      },
    );
  }

  async emitSuspiciousPattern(
    walletAddress: string,
    pattern: string,
    description: string,
    confidence: number,
  ): Promise<SecurityEvent> {
    return this.emit(
      "pattern.suspicious",
      "anomaly",
      "warning",
      walletAddress,
      {
        walletAddress,
        pattern,
        description,
        confidence,
      },
    );
  }

  // ── Session ID ────────────────────────────────────────────────────────────

  getSessionId(): string {
    return this.options.sessionId;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async emitRaw(
    type: string,
    category: SecurityEventCategory,
    severity: SecurityEventSeverity,
    actor: string,
    metadata: Record<string, unknown>,
  ): Promise<SecurityEvent> {
    const previousHash = this.log.getTailHash();
    const id = generateEventId();
    const timestamp = new Date().toISOString();

    // Build the event without eventHash first
    const partial = {
      id,
      timestamp,
      category,
      severity,
      type,
      actor,
      metadata,
      previousHash,
      sessionId: this.options.sessionId || undefined,
      clientId: this.options.clientId || undefined,
      eventHash: "", // placeholder
    };

    // Compute the hash over the partial (eventHash excluded by computeEventHash)
    const eventHash = await computeEventHash(partial);
    const event = { ...partial, eventHash } as SecurityEvent;

    // Append to immutable log
    await this.log.append(event);

    // Dispatch to listeners (errors in listeners must not break the chain)
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors are silently swallowed
      }
    }

    // Increment rate bucket
    this.incrementBucket(actor);

    return event;
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────

  private isRateLimited(actor: string): boolean {
    const bucket = this.rateBuckets.get(actor);
    if (!bucket) return false;
    const now = Date.now();
    if (now - bucket.windowStart > this.options.rateLimit.windowMs)
      return false;
    return bucket.count >= this.options.rateLimit.maxEventsPerWindow;
  }

  private getBucketCount(actor: string): number {
    return this.rateBuckets.get(actor)?.count ?? 0;
  }

  private incrementBucket(actor: string): void {
    const now = Date.now();
    const existing = this.rateBuckets.get(actor);
    if (
      !existing ||
      now - existing.windowStart > this.options.rateLimit.windowMs
    ) {
      this.rateBuckets.set(actor, { count: 1, windowStart: now });
    } else {
      existing.count++;
    }
  }
}

// ── ID generators ─────────────────────────────────────────────────────────────

function generateEventId(): string {
  // UUID v4 format
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant bits
  const hex = bytesToHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function generateSessionId(): string {
  return "sess-" + bytesToHex(randomBytes(12));
}
