/**
 * Failover HSM Provider
 *
 * Wraps a primary HSM provider (hardware) and a secondary provider (software)
 * with automatic failover. If the primary provider is unavailable or throws,
 * operations are transparently retried on the secondary.
 *
 * ## Failover behaviour
 * 1. On each operation, the primary is tried first.
 * 2. If the primary throws or is marked unavailable, the secondary is used.
 * 3. The primary is re-probed on a configurable interval so recovery is
 *    automatic once the hardware HSM comes back online.
 * 4. All failover events are emitted to the registered listener so the
 *    application can surface warnings to operators.
 *
 * ## Key synchronisation
 * Keys generated on the primary are NOT automatically mirrored to the
 * secondary. The secondary maintains its own independent key store.
 * Applications that need cross-provider key availability should call
 * `syncKey()` explicitly after generating a key on the primary.
 */

import {
  HsmProvider,
  HsmKeyHandle,
  HsmPublicKey,
  SignRequest,
  SignResult,
  CommitmentRequest,
  CommitmentResult,
  KeyAlgorithm,
  KeyUsage,
  HsmHealthStatus,
} from "./types";

// ── Failover event ────────────────────────────────────────────────────────────

export interface FailoverEvent {
  /** ISO-8601 timestamp of the failover. */
  timestamp: string;
  /** Name of the provider that failed. */
  failedProvider: string;
  /** Name of the provider that took over. */
  activeProvider: string;
  /** Operation that triggered the failover. */
  operation: string;
  /** Original error message from the failed provider. */
  reason: string;
}

export type FailoverListener = (event: FailoverEvent) => void;

// ── Provider ──────────────────────────────────────────────────────────────────

export class FailoverHsmProvider implements HsmProvider {
  readonly name: string;

  private readonly primary: HsmProvider;
  private readonly secondary: HsmProvider;
  private readonly probeIntervalMs: number;

  private primaryAvailable = true;
  private lastProbeAt = 0;
  private failoverListeners: FailoverListener[] = [];

  constructor(
    primary: HsmProvider,
    secondary: HsmProvider,
    options: {
      /** How often to re-probe the primary after a failure (ms, default: 30_000). */
      probeIntervalMs?: number;
    } = {},
  ) {
    this.primary = primary;
    this.secondary = secondary;
    this.probeIntervalMs = options.probeIntervalMs ?? 30_000;
    this.name = `Failover(${primary.name} → ${secondary.name})`;
  }

  // ── Listener registration ─────────────────────────────────────────────────

  onFailover(listener: FailoverListener): void {
    this.failoverListeners.push(listener);
  }

  offFailover(listener: FailoverListener): void {
    this.failoverListeners = this.failoverListeners.filter(
      (l) => l !== listener,
    );
  }

  // ── HsmProvider interface ─────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    const primaryOk = await this.primary.isAvailable();
    const secondaryOk = await this.secondary.isAvailable();
    return primaryOk || secondaryOk;
  }

  async generateKey(
    algorithm: KeyAlgorithm,
    usage: KeyUsage,
  ): Promise<HsmKeyHandle> {
    return this.withFailover("generateKey", (p) =>
      p.generateKey(algorithm, usage),
    );
  }

  async importKey(
    privateKeyHex: string,
    algorithm: KeyAlgorithm,
    usage: KeyUsage,
  ): Promise<HsmKeyHandle> {
    return this.withFailover("importKey", (p) =>
      p.importKey(privateKeyHex, algorithm, usage),
    );
  }

  async exportPublicKey(keyId: string): Promise<HsmPublicKey> {
    return this.withFailover("exportPublicKey", (p) =>
      p.exportPublicKey(keyId),
    );
  }

  async sign(request: SignRequest): Promise<SignResult> {
    return this.withFailover("sign", (p) => p.sign(request));
  }

  async generateCommitment(
    request: CommitmentRequest,
  ): Promise<CommitmentResult> {
    return this.withFailover("generateCommitment", (p) =>
      p.generateCommitment(request),
    );
  }

  async listKeys(): Promise<HsmKeyHandle[]> {
    return this.withFailover("listKeys", (p) => p.listKeys());
  }

  async deactivateKey(keyId: string): Promise<void> {
    return this.withFailover("deactivateKey", (p) => p.deactivateKey(keyId));
  }

  // ── Health diagnostics ────────────────────────────────────────────────────

  async getHealthStatus(): Promise<{
    primary: HsmHealthStatus;
    secondary: HsmHealthStatus;
    activeName: string;
  }> {
    const [primaryAvailable, secondaryAvailable] = await Promise.all([
      this.primary.isAvailable(),
      this.secondary.isAvailable(),
    ]);

    const [primaryKeys, secondaryKeys] = await Promise.all([
      primaryAvailable
        ? this.primary.listKeys().catch(() => [])
        : Promise.resolve([]),
      secondaryAvailable
        ? this.secondary.listKeys().catch(() => [])
        : Promise.resolve([]),
    ]);

    const now = new Date().toISOString();

    return {
      primary: {
        available: primaryAvailable,
        providerName: this.primary.name,
        activeKeyCount: primaryKeys.filter((k) => k.active).length,
        lastCheckedAt: now,
      },
      secondary: {
        available: secondaryAvailable,
        providerName: this.secondary.name,
        activeKeyCount: secondaryKeys.filter((k) => k.active).length,
        lastCheckedAt: now,
      },
      activeName: this.primaryAvailable
        ? this.primary.name
        : this.secondary.name,
    };
  }

  // ── Failover core ─────────────────────────────────────────────────────────

  /**
   * Execute `operation` on the active provider.
   * If the primary fails, mark it unavailable and retry on the secondary.
   * Re-probes the primary on the configured interval.
   */
  private async withFailover<T>(
    operationName: string,
    operation: (provider: HsmProvider) => Promise<T>,
  ): Promise<T> {
    // Attempt to recover the primary if the probe interval has elapsed
    await this.maybeReprobePrimary();

    if (this.primaryAvailable) {
      try {
        return await operation(this.primary);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.markPrimaryUnavailable(operationName, reason);
        // Fall through to secondary
      }
    }

    // Secondary attempt
    try {
      return await operation(this.secondary);
    } catch (secondaryErr) {
      const reason =
        secondaryErr instanceof Error
          ? secondaryErr.message
          : String(secondaryErr);
      throw new Error(
        `Both HSM providers failed for operation "${operationName}". ` +
          `Secondary error: ${reason}`,
      );
    }
  }

  private markPrimaryUnavailable(operation: string, reason: string): void {
    this.primaryAvailable = false;
    this.lastProbeAt = Date.now();

    const event: FailoverEvent = {
      timestamp: new Date().toISOString(),
      failedProvider: this.primary.name,
      activeProvider: this.secondary.name,
      operation,
      reason,
    };

    for (const listener of this.failoverListeners) {
      try {
        listener(event);
      } catch {
        // Listeners must not crash the provider
      }
    }
  }

  private async maybeReprobePrimary(): Promise<void> {
    if (this.primaryAvailable) return;
    if (Date.now() - this.lastProbeAt < this.probeIntervalMs) return;

    this.lastProbeAt = Date.now();
    try {
      const ok = await this.primary.isAvailable();
      if (ok) {
        this.primaryAvailable = true;
      }
    } catch {
      // Primary still unavailable
    }
  }
}
