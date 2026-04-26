/**
 * Security audit logging tests
 *
 * Covers:
 * - ImmutableAuditLog: append, chain hash linking, tamper detection,
 *   ring-buffer eviction, export, clear
 * - SecurityEventEmitter: typed emitters, hash chain continuity,
 *   listener dispatch, rate limiting, session ID attachment
 * - SecurityEventAggregator: filter, aggregate, time-series, anomaly
 *   detection, actor history
 * - canonicalJson: deterministic serialisation
 * - computeEventHash: hash stability and sensitivity
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ImmutableAuditLog,
  GENESIS_HASH,
  computeEventHash,
  computeChainHash,
  canonicalJson,
} from "../security/ImmutableAuditLog";
import { SecurityEventEmitter } from "../security/SecurityEventEmitter";
import { SecurityEventAggregator } from "../security/SecurityEventAggregator";
import { createSecurityLogger } from "../security/index";
import type { SecurityEvent } from "../security/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

let storeCounter = 0;
function uniqueStore() {
  return `test-store-${++storeCounter}`;
}

async function makeLog(maxEntries?: number) {
  const log = new ImmutableAuditLog({ storeName: uniqueStore(), maxEntries });
  await log.open();
  return log;
}

async function makeEmitter(log?: ImmutableAuditLog) {
  const l = log ?? (await makeLog());
  const emitter = new SecurityEventEmitter(l, { sessionId: "test-session" });
  return { log: l, emitter };
}

async function emitN(
  emitter: SecurityEventEmitter,
  n: number,
): Promise<SecurityEvent[]> {
  const events: SecurityEvent[] = [];
  for (let i = 0; i < n; i++) {
    const e = await emitter.emit(
      "test.event",
      "system",
      "info",
      `actor-${i % 3}`,
      { index: i },
    );
    events.push(e);
  }
  return events;
}

// ── canonicalJson ─────────────────────────────────────────────────────────────

describe("canonicalJson", () => {
  it("produces the same output regardless of key insertion order", () => {
    const a = canonicalJson({ z: 1, a: 2, m: 3 });
    const b = canonicalJson({ m: 3, z: 1, a: 2 });
    expect(a).toBe(b);
  });

  it("handles nested objects", () => {
    const result = canonicalJson({ b: { d: 4, c: 3 }, a: 1 });
    expect(result).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });

  it("handles arrays (order preserved)", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("handles null and primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("hello")).toBe('"hello"');
  });
});

// ── computeEventHash ──────────────────────────────────────────────────────────

describe("computeEventHash", () => {
  it("returns a 64-char hex string", async () => {
    const partial = {
      id: "test-id",
      timestamp: "2026-01-01T00:00:00.000Z",
      category: "system" as const,
      severity: "info" as const,
      type: "test",
      actor: "actor",
      metadata: {},
      previousHash: GENESIS_HASH,
      sessionId: undefined,
      clientId: undefined,
    };
    const hash = await computeEventHash(partial);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", async () => {
    const partial = {
      id: "abc",
      timestamp: "2026-01-01T00:00:00.000Z",
      category: "system" as const,
      severity: "info" as const,
      type: "test",
      actor: "actor",
      metadata: { x: 1 },
      previousHash: GENESIS_HASH,
    };
    const h1 = await computeEventHash(partial);
    const h2 = await computeEventHash(partial);
    expect(h1).toBe(h2);
  });

  it("changes when any field changes", async () => {
    const base = {
      id: "abc",
      timestamp: "2026-01-01T00:00:00.000Z",
      category: "system" as const,
      severity: "info" as const,
      type: "test",
      actor: "actor",
      metadata: {},
      previousHash: GENESIS_HASH,
    };
    const h1 = await computeEventHash(base);
    const h2 = await computeEventHash({ ...base, actor: "other" });
    expect(h1).not.toBe(h2);
  });

  it("excludes the eventHash field from its own computation", async () => {
    const partial = {
      id: "abc",
      timestamp: "2026-01-01T00:00:00.000Z",
      category: "system" as const,
      severity: "info" as const,
      type: "test",
      actor: "actor",
      metadata: {},
      previousHash: GENESIS_HASH,
      eventHash: "should-be-ignored",
    };
    const h1 = await computeEventHash(partial);
    const h2 = await computeEventHash({ ...partial, eventHash: "different" });
    expect(h1).toBe(h2);
  });
});

// ── ImmutableAuditLog ─────────────────────────────────────────────────────────

describe("ImmutableAuditLog", () => {
  it("starts empty", async () => {
    const log = await makeLog();
    expect(log.size).toBe(0);
    expect(log.getTailHash()).toBe(GENESIS_HASH);
  });

  it("appends events and updates size", async () => {
    const { log, emitter } = await makeEmitter();
    await emitter.emit("test", "system", "info", "actor", {});
    expect(log.size).toBe(1);
  });

  it("getTailHash returns the last event hash", async () => {
    const { log, emitter } = await makeEmitter();
    const e = await emitter.emit("test", "system", "info", "actor", {});
    expect(log.getTailHash()).toBe(e.eventHash);
  });

  it("getAll returns events in insertion order", async () => {
    const { log, emitter } = await makeEmitter();
    const events = await emitN(emitter, 5);
    const all = log.getAll();
    expect(all).toHaveLength(5);
    expect(all[0].id).toBe(events[0].id);
    expect(all[4].id).toBe(events[4].id);
  });

  it("getRecent returns the last n events", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 10);
    const recent = log.getRecent(3);
    expect(recent).toHaveLength(3);
  });

  it("ring-buffer evicts oldest events when maxEntries is exceeded", async () => {
    const log = await makeLog(5);
    const emitter = new SecurityEventEmitter(log);
    await emitN(emitter, 8);
    expect(log.size).toBe(5);
  });

  it("verify passes on an untampered chain", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 10);
    const result = await log.verify();
    expect(result.valid).toBe(true);
    expect(result.checkedCount).toBe(10);
    expect(result.violations).toHaveLength(0);
  });

  it("verify detects a tampered event hash", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 5);

    // Directly mutate the internal chain to simulate tampering
    const chain = log.getAll() as SecurityEvent[];
    // @ts-expect-error — intentional mutation for tamper test
    (chain[2] as { eventHash: string }).eventHash = "a".repeat(64);
    // Re-append the mutated event to the internal array via a cast
    const internalChain = (log as unknown as { chain: SecurityEvent[] }).chain;
    internalChain[2] = { ...internalChain[2], eventHash: "a".repeat(64) };

    const result = await log.verify();
    expect(result.valid).toBe(false);
    expect(result.firstTamperedIndex).toBeLessThanOrEqual(3);
  });

  it("verify detects a broken previousHash link", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 3);

    const internalChain = (log as unknown as { chain: SecurityEvent[] }).chain;
    internalChain[1] = { ...internalChain[1], previousHash: "b".repeat(64) };

    const result = await log.verify();
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("export produces valid JSON with chainHash", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 3);
    const exported = await log.export();
    const parsed = JSON.parse(exported);
    expect(parsed.eventCount).toBe(3);
    expect(parsed.chainHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.events).toHaveLength(3);
  });

  it("clear empties the chain", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 5);
    await log.clear();
    expect(log.size).toBe(0);
    expect(log.getTailHash()).toBe(GENESIS_HASH);
  });
});

// ── SecurityEventEmitter ──────────────────────────────────────────────────────

describe("SecurityEventEmitter", () => {
  it("emitted event has correct fields", async () => {
    const { emitter } = await makeEmitter();
    const e = await emitter.emit(
      "wallet.connect",
      "authentication",
      "info",
      "GTEST",
      {
        walletType: "freighter",
      },
    );
    expect(e.type).toBe("wallet.connect");
    expect(e.category).toBe("authentication");
    expect(e.severity).toBe("info");
    expect(e.actor).toBe("GTEST");
    expect(e.sessionId).toBe("test-session");
    expect(e.eventHash).toMatch(/^[0-9a-f]{64}$/);
    expect(e.previousHash).toBe(GENESIS_HASH);
  });

  it("each event's previousHash equals the prior event's eventHash", async () => {
    const { emitter } = await makeEmitter();
    const events = await emitN(emitter, 5);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].previousHash).toBe(events[i - 1].eventHash);
    }
  });

  it("first event's previousHash is GENESIS_HASH", async () => {
    const { emitter } = await makeEmitter();
    const e = await emitter.emit("test", "system", "info", "actor", {});
    expect(e.previousHash).toBe(GENESIS_HASH);
  });

  it("event IDs are unique", async () => {
    const { emitter } = await makeEmitter();
    const events = await emitN(emitter, 20);
    const ids = new Set(events.map((e) => e.id));
    expect(ids.size).toBe(20);
  });

  it("event IDs are UUID v4 format", async () => {
    const { emitter } = await makeEmitter();
    const e = await emitter.emit("test", "system", "info", "actor", {});
    expect(e.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("dispatches to registered listeners", async () => {
    const { emitter } = await makeEmitter();
    const received: SecurityEvent[] = [];
    emitter.onEvent((e) => received.push(e));
    await emitter.emit("test", "system", "info", "actor", {});
    expect(received).toHaveLength(1);
  });

  it("offEvent removes the listener", async () => {
    const { emitter } = await makeEmitter();
    const received: SecurityEvent[] = [];
    const listener = (e: SecurityEvent) => received.push(e);
    emitter.onEvent(listener);
    emitter.offEvent(listener);
    await emitter.emit("test", "system", "info", "actor", {});
    expect(received).toHaveLength(0);
  });

  it("listener errors do not break the chain", async () => {
    const { log, emitter } = await makeEmitter();
    emitter.onEvent(() => {
      throw new Error("listener crash");
    });
    await expect(
      emitter.emit("test", "system", "info", "actor", {}),
    ).resolves.toBeDefined();
    expect(log.size).toBe(1);
  });

  it("emitWalletConnect sets correct type and category", async () => {
    const { emitter } = await makeEmitter();
    const e = await emitter.emitWalletConnect(
      "GADDR",
      "freighter",
      "pubkey123",
    );
    expect(e.type).toBe("wallet.connect");
    expect(e.category).toBe("authentication");
    expect((e.metadata as { walletType: string }).walletType).toBe("freighter");
  });

  it("emitGameStarted sets correct type and metadata", async () => {
    const { emitter } = await makeEmitter();
    const e = await emitter.emitGameStarted(
      "game-1",
      "GADDR",
      1_000_000,
      "heads",
      "0xabc",
      "tx-hash",
    );
    expect(e.type).toBe("game.started");
    expect(e.category).toBe("transaction");
    expect((e.metadata as { wagerStroops: number }).wagerStroops).toBe(
      1_000_000,
    );
  });

  it("emitHsmFailover sets warning severity", async () => {
    const { emitter } = await makeEmitter();
    const e = await emitter.emitHsmFailover("hw", "sw", "sign", "timeout");
    expect(e.severity).toBe("warning");
    expect(e.type).toBe("hsm.failover");
  });

  it("emitCommitmentReplay sets critical severity", async () => {
    const { emitter } = await makeEmitter();
    const e = await emitter.emitCommitmentReplay("GADDR", "0xhash", "g1", "g2");
    expect(e.severity).toBe("critical");
    expect(e.type).toBe("commitment.replay");
  });

  it("rate limiting emits ratelimit.exceeded event", async () => {
    const log = await makeLog();
    const emitter = new SecurityEventEmitter(log, {
      rateLimit: { maxEventsPerWindow: 3, windowMs: 60_000 },
      emitRateLimitEvents: true,
    });

    // Emit 4 events from the same actor (exceeds limit of 3)
    for (let i = 0; i < 4; i++) {
      await emitter.emit("test", "system", "info", "heavy-actor", {});
    }

    const all = log.getAll();
    const rateLimitEvents = all.filter((e) => e.type === "ratelimit.exceeded");
    expect(rateLimitEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("getSessionId returns the configured session ID", async () => {
    const log = await makeLog();
    const emitter = new SecurityEventEmitter(log, { sessionId: "my-session" });
    expect(emitter.getSessionId()).toBe("my-session");
  });
});

// ── SecurityEventAggregator ───────────────────────────────────────────────────

describe("SecurityEventAggregator", () => {
  async function makeAggregator() {
    const log = new ImmutableAuditLog({ storeName: uniqueStore() });
    await log.open();
    const emitter = new SecurityEventEmitter(log, { sessionId: "agg-session" });
    const aggregator = new SecurityEventAggregator(log);
    return { log, emitter, aggregator };
  }

  it("aggregate returns zero counts for empty log", async () => {
    const { aggregator } = await makeAggregator();
    const result = aggregator.aggregate();
    expect(result.totalCount).toBe(0);
    expect(result.bySeverity.info).toBe(0);
  });

  it("aggregate counts events by category", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "authentication", "info", "actor", {});
    await emitter.emit("test", "authentication", "info", "actor", {});
    await emitter.emit("test", "transaction", "info", "actor", {});
    const result = aggregator.aggregate();
    expect(result.byCategory.authentication).toBe(2);
    expect(result.byCategory.transaction).toBe(1);
  });

  it("aggregate counts events by severity", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "system", "info", "actor", {});
    await emitter.emit("test", "system", "warning", "actor", {});
    await emitter.emit("test", "system", "critical", "actor", {});
    const result = aggregator.aggregate();
    expect(result.bySeverity.info).toBe(1);
    expect(result.bySeverity.warning).toBe(1);
    expect(result.bySeverity.critical).toBe(1);
  });

  it("aggregate byActor lists top actors", async () => {
    const { emitter, aggregator } = await makeAggregator();
    for (let i = 0; i < 5; i++) {
      await emitter.emit("test", "system", "info", "alice", {});
    }
    for (let i = 0; i < 2; i++) {
      await emitter.emit("test", "system", "info", "bob", {});
    }
    const result = aggregator.aggregate();
    expect(result.byActor[0].actor).toBe("alice");
    expect(result.byActor[0].count).toBe(5);
  });

  it("filter by category", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "authentication", "info", "actor", {});
    await emitter.emit("test", "transaction", "info", "actor", {});
    const filtered = aggregator.filter({ categories: ["authentication"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe("authentication");
  });

  it("filter by severity", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "system", "info", "actor", {});
    await emitter.emit("test", "system", "critical", "actor", {});
    const filtered = aggregator.filter({ severities: ["critical"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].severity).toBe("critical");
  });

  it("filter by actor", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "system", "info", "alice", {});
    await emitter.emit("test", "system", "info", "bob", {});
    const filtered = aggregator.filter({ actor: "alice" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].actor).toBe("alice");
  });

  it("filter by type", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("wallet.connect", "authentication", "info", "actor", {});
    await emitter.emit("game.started", "transaction", "info", "actor", {});
    const filtered = aggregator.filter({ types: ["wallet.connect"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe("wallet.connect");
  });

  it("filter by time range excludes out-of-range events", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "system", "info", "actor", {});
    const future = new Date(Date.now() + 10_000).toISOString();
    const filtered = aggregator.filter({
      timeRange: {
        start: future,
        end: new Date(Date.now() + 20_000).toISOString(),
      },
    });
    expect(filtered).toHaveLength(0);
  });

  it("filterRecent returns at most n events", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitN(emitter, 20);
    const recent = aggregator.filterRecent({}, 5);
    expect(recent.length).toBeLessThanOrEqual(5);
  });

  it("timeSeries returns correct bucket count", async () => {
    const { aggregator } = await makeAggregator();
    // 1 hour window, 5-minute buckets → 12 buckets
    const buckets = aggregator.timeSeries(3_600_000, 300_000);
    expect(buckets).toHaveLength(12);
  });

  it("timeSeries places events in the correct bucket", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "system", "info", "actor", {});
    // 10-minute window, 1-minute buckets → 10 buckets; the just-emitted event
    // must land in exactly one bucket regardless of sub-second timing.
    const buckets = aggregator.timeSeries(600_000, 60_000);
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
  });

  it("analyseAnomalies detects high-frequency actors", async () => {
    const { emitter, aggregator } = await makeAggregator();
    for (let i = 0; i < 60; i++) {
      await emitter.emit("test", "system", "info", "spammer", {});
    }
    const report = aggregator.analyseAnomalies(300_000, 50);
    expect(report.highFrequencyActors.some((a) => a.actor === "spammer")).toBe(
      true,
    );
  });

  it("analyseAnomalies detects repeated access denials", async () => {
    const { emitter, aggregator } = await makeAggregator();
    for (let i = 0; i < 4; i++) {
      await emitter.emitAccessDenied(
        "GATTACKER",
        "contract",
        "startGame",
        "unauthorized",
      );
    }
    const report = aggregator.analyseAnomalies();
    expect(report.repeatedDenials.some((d) => d.actor === "GATTACKER")).toBe(
      true,
    );
  });

  it("analyseAnomalies detects commitment replay attempts", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emitCommitmentReplay("GADDR", "0xhash", "g1", "g2");
    const report = aggregator.analyseAnomalies();
    expect(report.replayAttempts).toHaveLength(1);
  });

  it("analyseAnomalies detects critical events", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test.critical", "anomaly", "critical", "actor", {});
    const report = aggregator.analyseAnomalies();
    expect(report.criticalEvents).toHaveLength(1);
  });

  it("getActorHistory returns events for a specific actor newest first", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "system", "info", "alice", {});
    await emitter.emit("test", "system", "info", "bob", {});
    await emitter.emit("test", "system", "info", "alice", {});
    const history = aggregator.getActorHistory("alice");
    expect(history.every((e) => e.actor === "alice")).toBe(true);
    expect(history).toHaveLength(2);
  });

  it("getActorEventTypes returns type counts", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("wallet.connect", "authentication", "info", "alice", {});
    await emitter.emit("wallet.connect", "authentication", "info", "alice", {});
    await emitter.emit("game.started", "transaction", "info", "alice", {});
    const types = aggregator.getActorEventTypes("alice");
    expect(types["wallet.connect"]).toBe(2);
    expect(types["game.started"]).toBe(1);
  });

  it("exportFiltered produces valid JSON", async () => {
    const { emitter, aggregator } = await makeAggregator();
    await emitter.emit("test", "system", "info", "actor", {});
    const json = aggregator.exportFiltered({ categories: ["system"] });
    const parsed = JSON.parse(json);
    expect(parsed.eventCount).toBe(1);
    expect(parsed.events).toHaveLength(1);
  });
});

// ── createSecurityLogger factory ──────────────────────────────────────────────

describe("createSecurityLogger", () => {
  it("returns ready emitter and aggregator", async () => {
    const { emitter, aggregator, log } = await createSecurityLogger({
      sessionId: "factory-test",
      storeName: uniqueStore(),
    });
    expect(emitter).toBeDefined();
    expect(aggregator).toBeDefined();
    expect(log).toBeDefined();
  });

  it("emitter and aggregator share the same log", async () => {
    const { emitter, aggregator } = await createSecurityLogger({
      storeName: uniqueStore(),
    });
    await emitter.emit("test", "system", "info", "actor", {});
    expect(aggregator.aggregate().totalCount).toBe(1);
  });

  it("chain is valid after factory creation and emission", async () => {
    const { emitter, log } = await createSecurityLogger({
      storeName: uniqueStore(),
    });
    await emitN(emitter, 5);
    const result = await log.verify();
    expect(result.valid).toBe(true);
  });
});

// ── computeChainHash ──────────────────────────────────────────────────────────

describe("computeChainHash", () => {
  it("returns GENESIS_HASH for empty chain", async () => {
    expect(await computeChainHash([])).toBe(GENESIS_HASH);
  });

  it("returns a 64-char hex for non-empty chain", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 3);
    const hash = await computeChainHash(log.getAll() as SecurityEvent[]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any event changes", async () => {
    const { log, emitter } = await makeEmitter();
    await emitN(emitter, 3);
    const events = [...log.getAll()] as SecurityEvent[];
    const h1 = await computeChainHash(events);
    const modified = [...events];
    modified[1] = { ...modified[1], actor: "tampered" };
    const h2 = await computeChainHash(modified);
    expect(h1).not.toBe(h2);
  });
});
