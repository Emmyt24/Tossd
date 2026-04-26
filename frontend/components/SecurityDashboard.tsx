/**
 * SecurityDashboard
 *
 * Real-time security audit log monitoring panel. Displays:
 * - Event counts by severity (info / warning / error / critical)
 * - Category breakdown with proportional bars
 * - Chain integrity status (tamper-evident hash verification)
 * - Anomaly alerts (high-frequency actors, replay attempts, repeated denials)
 * - Live event feed (50 most recent events)
 *
 * Designed to be embedded in an admin panel or developer overlay.
 * All data comes from the `useSecurityLog` hook — no direct log access.
 */

import React, { useCallback, useState } from "react";
import styles from "./SecurityDashboard.module.css";
import type {
  SecurityEventAggregation,
  SecurityEvent,
  AnomalyReport,
  ChainVerificationResult,
  SecurityEventCategory,
} from "../security/types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SecurityDashboardProps {
  /** Aggregate stats from useSecurityLog. */
  stats: SecurityEventAggregation | null;
  /** Recent events from useSecurityLog. */
  recentEvents: SecurityEvent[];
  /** Anomaly report from useSecurityLog. */
  anomalies: AnomalyReport | null;
  /** Whether the logger is ready. */
  ready: boolean;
  /** Callback to trigger chain verification. */
  onVerifyChain: () => Promise<ChainVerificationResult | null>;
  /** Callback to trigger anomaly analysis. */
  onAnalyseAnomalies: () => void;
  /** Callback to export the log. */
  onExport?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SecurityDashboard({
  stats,
  recentEvents,
  anomalies,
  ready,
  onVerifyChain,
  onAnalyseAnomalies,
  onExport,
}: SecurityDashboardProps) {
  const [chainResult, setChainResult] =
    useState<ChainVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    try {
      const result = await onVerifyChain();
      setChainResult(result);
    } finally {
      setVerifying(false);
    }
  }, [onVerifyChain]);

  if (!ready) {
    return (
      <div className={styles.dashboard}>
        <p className={styles.empty}>Initialising security logger…</p>
      </div>
    );
  }

  const totalEvents = stats?.totalCount ?? 0;
  const maxCategory = stats
    ? Math.max(...Object.values(stats.byCategory), 1)
    : 1;

  const chainStatusClass =
    chainResult === null
      ? styles.chainUnknown
      : chainResult.valid
        ? styles.chainValid
        : styles.chainInvalid;

  const chainLabel =
    chainResult === null
      ? "Chain unverified"
      : chainResult.valid
        ? `Chain valid (${chainResult.checkedCount} events)`
        : `⚠ Tampered at #${chainResult.firstTamperedIndex}`;

  return (
    <div
      className={styles.dashboard}
      role="region"
      aria-label="Security audit log"
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Security Audit Log</h2>
        <button
          className={`${styles.chainStatus} ${chainStatusClass}`}
          onClick={handleVerify}
          disabled={verifying}
          aria-label="Verify chain integrity"
          title="Click to verify tamper-evident hash chain"
        >
          <span className={styles.dot} aria-hidden="true" />
          {verifying ? "Verifying…" : chainLabel}
        </button>
      </div>

      {/* Severity stat cards */}
      <div
        className={styles.statsGrid}
        role="list"
        aria-label="Event counts by severity"
      >
        <StatCard
          label="Total"
          value={totalEvents}
          className={styles.severityTotal}
        />
        <StatCard
          label="Info"
          value={stats?.bySeverity.info ?? 0}
          className={styles.severityInfo}
        />
        <StatCard
          label="Warning"
          value={stats?.bySeverity.warning ?? 0}
          className={styles.severityWarning}
        />
        <StatCard
          label="Error"
          value={stats?.bySeverity.error ?? 0}
          className={styles.severityError}
        />
        <StatCard
          label="Critical"
          value={stats?.bySeverity.critical ?? 0}
          className={styles.severityCritical}
        />
      </div>

      {/* Category breakdown */}
      <section className={styles.section} aria-label="Events by category">
        <h3 className={styles.sectionTitle}>By category</h3>
        {CATEGORIES.map((cat) => {
          const count = stats?.byCategory[cat] ?? 0;
          const pct = totalEvents > 0 ? (count / maxCategory) * 100 : 0;
          return (
            <div key={cat} className={styles.categoryRow}>
              <span className={styles.categoryLabel}>{cat}</span>
              <div className={styles.barTrack} role="presentation">
                <div
                  className={styles.barFill}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </div>
              <span
                className={styles.categoryCount}
                aria-label={`${count} events`}
              >
                {count}
              </span>
            </div>
          );
        })}
      </section>

      {/* Anomaly alerts */}
      <section className={styles.section} aria-label="Anomaly alerts">
        <h3 className={styles.sectionTitle}>Anomalies</h3>
        <AnomalyAlerts anomalies={anomalies} />
      </section>

      {/* Live event feed */}
      <section className={styles.section} aria-label="Recent security events">
        <h3 className={styles.sectionTitle}>
          Recent events ({recentEvents.length})
        </h3>
        <EventFeed events={recentEvents} />
      </section>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={onAnalyseAnomalies}>
          Analyse anomalies
        </button>
        <button
          className={styles.actionBtn}
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? "Verifying…" : "Verify chain"}
        </button>
        {onExport && (
          <button className={styles.actionBtn} onClick={onExport}>
            Export log
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={styles.statCard} role="listitem">
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${className}`}>{value}</span>
    </div>
  );
}

function AnomalyAlerts({ anomalies }: { anomalies: AnomalyReport | null }) {
  if (!anomalies) {
    return <p className={styles.empty}>Run analysis to detect anomalies.</p>;
  }

  const items: string[] = [];

  for (const a of anomalies.highFrequencyActors) {
    items.push(
      `High-frequency actor: ${truncateAddr(a.actor)} — ${a.eventCount} events` +
        (a.criticalCount > 0 ? ` (${a.criticalCount} critical)` : ""),
    );
  }
  for (const d of anomalies.repeatedDenials) {
    items.push(
      `Repeated access denials: ${truncateAddr(d.actor)} — ${d.denialCount}×`,
    );
  }
  for (const r of anomalies.replayAttempts) {
    items.push(`Commitment replay attempt by ${truncateAddr(r.actor)}`);
  }
  for (const c of anomalies.criticalEvents) {
    items.push(`Critical: ${c.type} by ${truncateAddr(c.actor)}`);
  }

  if (items.length === 0) {
    return (
      <p className={styles.noAnomalies}>
        ✓ No anomalies detected in the last{" "}
        {Math.round(anomalies.windowMs / 60_000)} min
      </p>
    );
  }

  return (
    <ul className={styles.anomalyList} aria-label="Detected anomalies">
      {items.map((text, i) => (
        <li key={i} className={styles.anomalyItem}>
          <span className={styles.anomalyIcon} aria-hidden="true">
            ⚠
          </span>
          <span className={styles.anomalyText}>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function EventFeed({ events }: { events: SecurityEvent[] }) {
  if (events.length === 0) {
    return <p className={styles.empty}>No events recorded yet.</p>;
  }

  return (
    <div
      className={styles.eventFeed}
      role="log"
      aria-live="polite"
      aria-label="Security event feed"
    >
      {events.map((e) => (
        <div key={e.id} className={styles.eventRow} role="row">
          <span className={styles.eventTime} title={e.timestamp}>
            {formatTime(e.timestamp)}
          </span>
          <span
            className={`${styles.eventSeverityBadge} ${styles[`badge-${e.severity}`]}`}
            aria-label={`Severity: ${e.severity}`}
          >
            {e.severity}
          </span>
          <span className={styles.eventType} title={e.type}>
            {e.type}
          </span>
          <span className={styles.eventActor} title={e.actor}>
            {truncateAddr(e.actor)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES: SecurityEventCategory[] = [
  "authentication",
  "authorization",
  "cryptographic",
  "transaction",
  "system",
  "anomaly",
];

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(11, 19);
  }
}

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return addr.slice(0, 8) + "…" + addr.slice(-6);
}
