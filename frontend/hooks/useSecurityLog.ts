/**
 * useSecurityLog — React hook for the security audit logging system.
 *
 * Initialises the logger on mount, exposes the emitter for event emission,
 * and provides live aggregation stats that re-render when new events arrive.
 *
 * ## Usage
 * ```tsx
 * const { emitter, stats, recentEvents, anomalies, verifyChain } = useSecurityLog({
 *   sessionId: walletAddress,
 * });
 *
 * // Emit an event
 * await emitter?.emitWalletConnect(address, "freighter", pubKey);
 *
 * // Stats update automatically after each emission
 * console.log(stats?.bySeverity.critical);
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSecurityLogger,
  SecurityEventEmitter,
  SecurityEventAggregator,
  ImmutableAuditLog,
  SecurityEventAggregation,
  SecurityEvent,
  AnomalyReport,
  ChainVerificationResult,
  SecurityEventFilter,
  SecurityEventEmitterOptions,
} from "../security";

// ── Hook state ────────────────────────────────────────────────────────────────

export interface UseSecurityLogState {
  /** The emitter — use this to emit security events. Null until initialised. */
  emitter: SecurityEventEmitter | null;
  /** The aggregator — use this for queries and analysis. Null until initialised. */
  aggregator: SecurityEventAggregator | null;
  /** The raw immutable log. Null until initialised. */
  log: ImmutableAuditLog | null;
  /** True once the logger is initialised and ready. */
  ready: boolean;
  /** Aggregate stats over all events (refreshed after each emission). */
  stats: SecurityEventAggregation | null;
  /** The 50 most recent events (refreshed after each emission). */
  recentEvents: SecurityEvent[];
  /** Latest anomaly analysis (refreshed on demand or after critical events). */
  anomalies: AnomalyReport | null;
  /** Non-null if initialisation failed. */
  error: string | null;
}

export interface UseSecurityLogActions {
  /** Manually refresh stats and recent events. */
  refresh(): void;
  /** Run chain integrity verification and return the result. */
  verifyChain(): Promise<ChainVerificationResult | null>;
  /** Run anomaly analysis over the given window (default: 5 min). */
  analyseAnomalies(windowMs?: number): AnomalyReport | null;
  /** Filter events using the aggregator. */
  filterEvents(f: SecurityEventFilter): SecurityEvent[];
}

export type UseSecurityLogResult = UseSecurityLogState & UseSecurityLogActions;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSecurityLog(
  options: SecurityEventEmitterOptions & {
    storeName?: string;
    maxEntries?: number;
    /** Auto-refresh interval in ms (default: 0 = disabled). */
    refreshIntervalMs?: number;
  } = {},
): UseSecurityLogResult {
  const emitterRef = useRef<SecurityEventEmitter | null>(null);
  const aggregatorRef = useRef<SecurityEventAggregator | null>(null);
  const logRef = useRef<ImmutableAuditLog | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SecurityEventAggregation | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyReport | null>(null);

  // Refresh derived state from the aggregator
  const refresh = useCallback(() => {
    const agg = aggregatorRef.current;
    if (!agg) return;
    setStats(agg.aggregate());
    setRecentEvents([...agg.filterRecent({}, 50)].reverse());
  }, []);

  // Initialise on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { log, emitter, aggregator } = await createSecurityLogger({
          sessionId: options.sessionId,
          clientId: options.clientId,
          rateLimit: options.rateLimit,
          storeName: options.storeName,
          maxEntries: options.maxEntries,
        });

        if (cancelled) return;

        // Wire up a listener so stats refresh after every emission
        emitter.onEvent(() => {
          if (!cancelled) {
            setStats(aggregator.aggregate());
            setRecentEvents([...aggregator.filterRecent({}, 50)].reverse());
          }
        });

        emitterRef.current = emitter;
        aggregatorRef.current = aggregator;
        logRef.current = log;

        setReady(true);
        setError(null);

        // Initial stats load
        setStats(aggregator.aggregate());
        setRecentEvents([...aggregator.filterRecent({}, 50)].reverse());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.sessionId, options.storeName]);

  // Optional auto-refresh interval
  useEffect(() => {
    if (!options.refreshIntervalMs || options.refreshIntervalMs <= 0) return;
    const id = setInterval(refresh, options.refreshIntervalMs);
    return () => clearInterval(id);
  }, [options.refreshIntervalMs, refresh]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const verifyChain =
    useCallback(async (): Promise<ChainVerificationResult | null> => {
      if (!logRef.current) return null;
      return logRef.current.verify();
    }, []);

  const analyseAnomalies = useCallback(
    (windowMs?: number): AnomalyReport | null => {
      if (!aggregatorRef.current) return null;
      const report = aggregatorRef.current.analyseAnomalies(windowMs);
      setAnomalies(report);
      return report;
    },
    [],
  );

  const filterEvents = useCallback(
    (f: SecurityEventFilter): SecurityEvent[] => {
      if (!aggregatorRef.current) return [];
      return aggregatorRef.current.filter(f);
    },
    [],
  );

  return {
    emitter: emitterRef.current,
    aggregator: aggregatorRef.current,
    log: logRef.current,
    ready,
    stats,
    recentEvents,
    anomalies,
    error,
    refresh,
    verifyChain,
    analyseAnomalies,
    filterEvents,
  };
}
