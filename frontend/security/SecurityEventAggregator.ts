/**
 * Security Event Aggregator
 *
 * Provides filtering, aggregation, and time-series analysis over the
 * immutable audit log. All operations are read-only — the aggregator
 * never modifies the underlying log.
 *
 * ## Capabilities
 * - Filter events by category, severity, actor, session, time range, type
 * - Aggregate counts by category / severity / actor
 * - Build time-series buckets for dashboard charts
 * - Detect anomaly trends (spike detection, actor frequency analysis)
 * - Export filtered subsets for forensic reporting
 */

import {
  SecurityEvent,
  SecurityEventFilter,
  SecurityEventAggregation,
  SecurityEventCategory,
  SecurityEventSeverity,
} from "./types";
import { ImmutableAuditLog } from "./ImmutableAuditLog";

// ── Time-series bucket ────────────────────────────────────────────────────────

export interface TimeSeriesBucket {
  /** ISO-8601 start of this bucket. */
  bucketStart: string;
  /** Total events in this bucket. */
  count: number;
  /** Breakdown by severity within this bucket. */
  bySeverity: Record<SecurityEventSeverity, number>;
}

// ── Anomaly report ────────────────────────────────────────────────────────────

export interface AnomalyReport {
  /** Actors with unusually high event rates. */
  highFrequencyActors: Array<{
    actor: string;
    eventCount: number;
    criticalCount: number;
  }>;
  /** Critical events in the analysis window. */
  criticalEvents: SecurityEvent[];
  /** Actors with repeated access denials. */
  repeatedDenials: Array<{ actor: string; denialCount: number }>;
  /** Commitment replay attempts detected. */
  replayAttempts: SecurityEvent[];
  /** Time window analysed. */
  windowMs: number;
}

// ── Aggregator ────────────────────────────────────────────────────────────────

export class SecurityEventAggregator {
  private readonly log: ImmutableAuditLog;

  constructor(log: ImmutableAuditLog) {
    this.log = log;
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  /**
   * Return all events matching the given filter.
   * All filter fields are ANDed; within multi-value fields (categories,
   * severities, types) values are ORed.
   */
  filter(f: SecurityEventFilter): SecurityEvent[] {
    return this.log.getAll().filter((e) => this.matches(e, f));
  }

  /** Return the most recent `n` events matching the filter. */
  filterRecent(f: SecurityEventFilter, n: number): SecurityEvent[] {
    const all = this.filter(f);
    return all.slice(-n);
  }

  // ── Aggregation ───────────────────────────────────────────────────────────

  /**
   * Aggregate events matching the filter into counts by category, severity,
   * and actor.
   */
  aggregate(f: SecurityEventFilter = {}): SecurityEventAggregation {
    const events = this.filter(f);

    const byCategory = emptyByCategory();
    const bySeverity = emptyBySeverity();
    const actorCounts = new Map<string, number>();
    let earliest = "";
    let latest = "";

    for (const e of events) {
      byCategory[e.category]++;
      bySeverity[e.severity]++;
      actorCounts.set(e.actor, (actorCounts.get(e.actor) ?? 0) + 1);
      if (!earliest || e.timestamp < earliest) earliest = e.timestamp;
      if (!latest || e.timestamp > latest) latest = e.timestamp;
    }

    const byActor = Array.from(actorCounts.entries())
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCount: events.length,
      byCategory,
      bySeverity,
      byActor,
      timeRange: {
        earliest: earliest || new Date().toISOString(),
        latest: latest || new Date().toISOString(),
      },
    };
  }

  // ── Time series ───────────────────────────────────────────────────────────

  /**
   * Build a time-series histogram of events over the given window.
   *
   * @param windowMs    - Total window to analyse (e.g. 3_600_000 for 1 hour)
   * @param bucketMs    - Size of each bucket (e.g. 60_000 for 1-minute buckets)
   * @param filter      - Optional event filter applied before bucketing
   */
  timeSeries(
    windowMs: number,
    bucketMs: number,
    filter: SecurityEventFilter = {},
  ): TimeSeriesBucket[] {
    const now = Date.now();
    const windowStart = now - windowMs;
    const bucketCount = Math.ceil(windowMs / bucketMs);

    // Initialise empty buckets
    const buckets: TimeSeriesBucket[] = Array.from(
      { length: bucketCount },
      (_, i) => ({
        bucketStart: new Date(windowStart + i * bucketMs).toISOString(),
        count: 0,
        bySeverity: emptyBySeverity(),
      }),
    );

    const events = this.filter({
      ...filter,
      timeRange: {
        start: new Date(windowStart).toISOString(),
        // Add 1 ms so events timestamped at exactly `now` are included
        end: new Date(now + 1).toISOString(),
      },
    });

    for (const e of events) {
      const ts = new Date(e.timestamp).getTime();
      const bucketIndex = Math.min(
        Math.floor((ts - windowStart) / bucketMs),
        bucketCount - 1,
      );
      if (bucketIndex >= 0) {
        buckets[bucketIndex].count++;
        buckets[bucketIndex].bySeverity[e.severity]++;
      }
    }

    return buckets;
  }

  // ── Anomaly analysis ──────────────────────────────────────────────────────

  /**
   * Analyse the recent event window for anomalous patterns.
   *
   * @param windowMs - How far back to look (default: 5 minutes)
   * @param highFrequencyThreshold - Events per actor to flag as high-frequency
   */
  analyseAnomalies(
    windowMs = 5 * 60_000,
    highFrequencyThreshold = 50,
  ): AnomalyReport {
    const since = new Date(Date.now() - windowMs).toISOString();
    const recent = this.filter({
      timeRange: { start: since, end: new Date().toISOString() },
    });

    // High-frequency actors
    const actorMap = new Map<string, { total: number; critical: number }>();
    for (const e of recent) {
      const existing = actorMap.get(e.actor) ?? { total: 0, critical: 0 };
      existing.total++;
      if (e.severity === "critical") existing.critical++;
      actorMap.set(e.actor, existing);
    }
    const highFrequencyActors = Array.from(actorMap.entries())
      .filter(([, v]) => v.total >= highFrequencyThreshold)
      .map(([actor, v]) => ({
        actor,
        eventCount: v.total,
        criticalCount: v.critical,
      }))
      .sort((a, b) => b.eventCount - a.eventCount);

    // Critical events
    const criticalEvents = recent.filter((e) => e.severity === "critical");

    // Repeated access denials (3+ in window)
    const denialMap = new Map<string, number>();
    for (const e of recent) {
      if (e.type === "access.denied") {
        denialMap.set(e.actor, (denialMap.get(e.actor) ?? 0) + 1);
      }
    }
    const repeatedDenials = Array.from(denialMap.entries())
      .filter(([, count]) => count >= 3)
      .map(([actor, denialCount]) => ({ actor, denialCount }))
      .sort((a, b) => b.denialCount - a.denialCount);

    // Commitment replay attempts
    const replayAttempts = recent.filter((e) => e.type === "commitment.replay");

    return {
      highFrequencyActors,
      criticalEvents,
      repeatedDenials,
      replayAttempts,
      windowMs,
    };
  }

  // ── Per-actor history ─────────────────────────────────────────────────────

  /** Return all events for a specific actor, newest first. */
  getActorHistory(actor: string, limit = 100): SecurityEvent[] {
    return this.filter({ actor }).slice(-limit).reverse();
  }

  /** Return the event counts per type for a specific actor. */
  getActorEventTypes(actor: string): Record<string, number> {
    const events = this.filter({ actor });
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    return counts;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Export a filtered subset as a JSON string for forensic reporting.
   */
  exportFiltered(f: SecurityEventFilter): string {
    const events = this.filter(f);
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        filter: f,
        eventCount: events.length,
        events,
      },
      null,
      2,
    );
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private matches(event: SecurityEvent, f: SecurityEventFilter): boolean {
    if (f.categories?.length && !f.categories.includes(event.category)) {
      return false;
    }
    if (f.severities?.length && !f.severities.includes(event.severity)) {
      return false;
    }
    if (f.actor !== undefined && event.actor !== f.actor) {
      return false;
    }
    if (f.sessionId !== undefined && event.sessionId !== f.sessionId) {
      return false;
    }
    if (f.types?.length && !f.types.includes(event.type)) {
      return false;
    }
    if (f.timeRange) {
      if (event.timestamp < f.timeRange.start) return false;
      if (event.timestamp > f.timeRange.end) return false;
    }
    return true;
  }
}

// ── Zero-value helpers ────────────────────────────────────────────────────────

function emptyByCategory(): Record<SecurityEventCategory, number> {
  return {
    authentication: 0,
    authorization: 0,
    cryptographic: 0,
    transaction: 0,
    system: 0,
    anomaly: 0,
  };
}

function emptyBySeverity(): Record<SecurityEventSeverity, number> {
  return { info: 0, warning: 0, error: 0, critical: 0 };
}
