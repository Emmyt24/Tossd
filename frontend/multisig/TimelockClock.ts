/**
 * TimelockClock
 *
 * Reactive countdown timer for timelock-gated proposals.
 * Polls the engine on a configurable interval and fires callbacks when:
 *   - A proposal transitions from `queued` → `ready`
 *   - A proposal transitions from `pending` → `expired`
 *
 * Designed to be used by the React hook (`useMultisig`) to drive UI updates
 * without requiring the component to manage its own intervals.
 */

import { ProposalEngine } from "./ProposalEngine";
import type { Proposal, TimelockStatus } from "./types";

export type TimelockReadyCallback = (proposal: Proposal) => void;
export type TimelockExpiredCallback = (proposal: Proposal) => void;

export class TimelockClock {
  private readonly engine: ProposalEngine;
  private readonly pollIntervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;

  private onReady: TimelockReadyCallback[] = [];
  private onExpired: TimelockExpiredCallback[] = [];

  /** Snapshot of statuses from the last poll, keyed by proposal ID. */
  private lastStatuses = new Map<string, string>();

  constructor(engine: ProposalEngine, pollIntervalMs = 5_000) {
    this.engine = engine;
    this.pollIntervalMs = pollIntervalMs;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.timerId !== null) return;
    this.timerId = setInterval(() => this.tick(), this.pollIntervalMs);
    // Run immediately
    this.tick();
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  // ── Listener registration ─────────────────────────────────────────────────

  onTimelockReady(cb: TimelockReadyCallback): void {
    this.onReady.push(cb);
  }

  onTimelockExpired(cb: TimelockExpiredCallback): void {
    this.onExpired.push(cb);
  }

  offTimelockReady(cb: TimelockReadyCallback): void {
    this.onReady = this.onReady.filter((c) => c !== cb);
  }

  offTimelockExpired(cb: TimelockExpiredCallback): void {
    this.onExpired = this.onExpired.filter((c) => c !== cb);
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /**
   * Return the current timelock status for all active proposals.
   */
  getActiveTimelocks(): TimelockStatus[] {
    return this.engine
      .listProposals({ status: "queued" })
      .map((p) => this.engine.getTimelockStatus(p.id))
      .filter((s): s is TimelockStatus => s !== null);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private tick(): void {
    const proposals = this.engine.listProposals();

    for (const proposal of proposals) {
      const prev = this.lastStatuses.get(proposal.id);

      if (prev !== proposal.status) {
        if (proposal.status === "ready" && prev === "queued") {
          for (const cb of this.onReady) {
            try {
              cb(proposal);
            } catch {
              /* swallow */
            }
          }
        }
        if (proposal.status === "expired" && prev === "pending") {
          for (const cb of this.onExpired) {
            try {
              cb(proposal);
            } catch {
              /* swallow */
            }
          }
        }
        this.lastStatuses.set(proposal.id, proposal.status);
      }
    }
  }
}
