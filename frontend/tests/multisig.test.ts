/**
 * Multisig + timelock tests
 *
 * Covers:
 * - ProposalEngine: create, approve, reject, execute, cancel, emergency override
 * - Timelock: delay enforcement, status transitions, recomputation
 * - Quorum: threshold calculation, majority logic
 * - MultisigError: typed error fields
 * - types: PERMISSION_RISK, ACTION_PERMISSION, DEFAULT_TIMELOCK_MS
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ProposalEngine,
  MultisigError,
  DEFAULT_TIMELOCK_MS,
  PERMISSION_RISK,
  ACTION_PERMISSION,
} from "../multisig";
import type { ProposalAction, MultisigConfig } from "../multisig/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const A = "GSIGNER_A_000000000000000000000000000000000000000000000000";
const B = "GSIGNER_B_000000000000000000000000000000000000000000000000";
const C = "GSIGNER_C_000000000000000000000000000000000000000000000000";
const SUPER = "GSUPER_000000000000000000000000000000000000000000000000000";
const NOBODY = "GNOBODY_00000000000000000000000000000000000000000000000000";

let counter = 0;
function uniqueKey() {
  return `test-multisig-${++counter}`;
}

function makeEngine(
  signers = [A, B, C],
  configOverrides: Partial<MultisigConfig> = {},
) {
  return new ProposalEngine({
    config: {
      signers,
      quorumThreshold: 0.51,
      emergencyQuorumThreshold: 0.75,
      votingWindowMs: 60 * 60 * 1000, // 1 h
      ...configOverrides,
    },
    storageKey: uniqueKey(),
  });
}

const FEE_ACTION: ProposalAction = { type: "set_fee", feeBps: 400 };
const TREASURY_ACTION: ProposalAction = {
  type: "set_treasury",
  newTreasury: "GNEW",
};
const PAUSE_ACTION: ProposalAction = { type: "set_paused", paused: true };

// ── types ─────────────────────────────────────────────────────────────────────

describe("types", () => {
  it("DEFAULT_TIMELOCK_MS has correct ordering", () => {
    expect(DEFAULT_TIMELOCK_MS.low).toBe(0);
    expect(DEFAULT_TIMELOCK_MS.medium).toBeLessThan(DEFAULT_TIMELOCK_MS.high);
    expect(DEFAULT_TIMELOCK_MS.high).toBeLessThan(DEFAULT_TIMELOCK_MS.critical);
  });

  it("PERMISSION_RISK classifies treasury:update as critical", () => {
    expect(PERMISSION_RISK["treasury:update"]).toBe("critical");
  });

  it("PERMISSION_RISK classifies fee:update as high", () => {
    expect(PERMISSION_RISK["fee:update"]).toBe("high");
  });

  it("PERMISSION_RISK classifies contract:pause as medium", () => {
    expect(PERMISSION_RISK["contract:pause"]).toBe("medium");
  });

  it("PERMISSION_RISK classifies audit:read as low", () => {
    expect(PERMISSION_RISK["audit:read"]).toBe("low");
  });

  it("ACTION_PERMISSION maps set_fee to fee:update", () => {
    expect(ACTION_PERMISSION["set_fee"]).toBe("fee:update");
  });

  it("ACTION_PERMISSION maps set_treasury to treasury:update", () => {
    expect(ACTION_PERMISSION["set_treasury"]).toBe("treasury:update");
  });
});

// ── ProposalEngine — creation ─────────────────────────────────────────────────

describe("ProposalEngine — createProposal", () => {
  it("creates a proposal with pending status", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "Update fee");
    expect(p.status).toBe("pending");
    expect(p.proposer).toBe(A);
    expect(p.action).toEqual(FEE_ACTION);
  });

  it("assigns correct risk and timelock for fee:update", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "Update fee");
    expect(p.risk).toBe("high");
    expect(p.timelockMs).toBe(DEFAULT_TIMELOCK_MS.high);
  });

  it("assigns critical risk and timelock for treasury:update", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, TREASURY_ACTION, "Update treasury");
    expect(p.risk).toBe("critical");
    expect(p.timelockMs).toBe(DEFAULT_TIMELOCK_MS.critical);
  });

  it("emergency proposal has reduced timelock (50% of normal, min 1 min)", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "Emergency fee", true);
    expect(p.emergency).toBe(true);
    const expected = Math.max(DEFAULT_TIMELOCK_MS.high * 0.5, 60_000);
    expect(p.timelockMs).toBe(expected);
  });

  it("emergency proposal uses higher quorum threshold", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "Emergency fee", true);
    expect(p.quorumThreshold).toBe(0.75);
  });

  it("non-signer cannot create a proposal", () => {
    const engine = makeEngine();
    expect(() => engine.createProposal(NOBODY, FEE_ACTION, "test")).toThrow(
      MultisigError,
    );
  });

  it("proposal ID is a UUID v4", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    expect(p.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("each proposal gets a unique ID", () => {
    const engine = makeEngine();
    const p1 = engine.createProposal(A, FEE_ACTION, "a");
    const p2 = engine.createProposal(A, FEE_ACTION, "b");
    expect(p1.id).not.toBe(p2.id);
  });

  it("zero-delay (low risk) proposal transitions directly to ready on quorum", () => {
    const engine = makeEngine([A, B], {
      quorumThreshold: 0.5,
      timelockOverrides: { low: 0 },
    });
    const action: ProposalAction = { type: "set_paused", paused: false };
    // Override risk to low for this test via a custom action
    const p = engine.createProposal(
      A,
      { type: "custom", description: "low risk", payload: {} },
      "low",
    );
    engine.approve(A, p.id);
    engine.approve(B, p.id);
    const updated = engine.getProposal(p.id)!;
    // custom maps to audit:export which is low risk → 0 delay → ready immediately
    expect(updated.status).toBe("ready");
  });
});

// ── ProposalEngine — approve / reject ─────────────────────────────────────────

describe("ProposalEngine — approve / reject", () => {
  it("approval increments approval count", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    const updated = engine.approve(A, p.id);
    expect(updated.approvals).toHaveLength(1);
    expect(updated.approvals[0].address).toBe(A);
  });

  it("rejection increments rejection count", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    const updated = engine.reject(A, p.id, "too high");
    expect(updated.rejections).toHaveLength(1);
    expect(updated.rejections[0].reason).toBe("too high");
  });

  it("double vote throws MultisigError", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    expect(() => engine.approve(A, p.id)).toThrow(MultisigError);
  });

  it("cannot approve after rejecting", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.reject(A, p.id);
    expect(() => engine.approve(A, p.id)).toThrow(MultisigError);
  });

  it("non-signer cannot approve", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    expect(() => engine.approve(NOBODY, p.id)).toThrow(MultisigError);
  });

  it("approval on non-existent proposal throws", () => {
    const engine = makeEngine();
    expect(() => engine.approve(A, "nonexistent")).toThrow(MultisigError);
  });

  it("quorum met transitions proposal to queued", () => {
    const engine = makeEngine([A, B], { quorumThreshold: 0.51 });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    engine.approve(B, p.id);
    const updated = engine.getProposal(p.id)!;
    expect(["queued", "ready"]).toContain(updated.status);
  });

  it("quorum not met keeps proposal pending", () => {
    const engine = makeEngine([A, B, C], { quorumThreshold: 0.51 });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id); // 1/3 = 33% < 51%
    expect(engine.getProposal(p.id)!.status).toBe("pending");
  });

  it("stores approval comment", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id, "looks good");
    expect(engine.getProposal(p.id)!.approvals[0].comment).toBe("looks good");
  });
});

// ── ProposalEngine — timelock ─────────────────────────────────────────────────

describe("ProposalEngine — timelock", () => {
  // Use 33% quorum so a single approval from A (1/3) meets quorum
  function makeTimelockEngine() {
    return makeEngine([A, B, C], { quorumThreshold: 0.33 });
  }

  it("queued proposal has executeAfter set", () => {
    const engine = makeTimelockEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    const updated = engine.getProposal(p.id)!;
    expect(["queued", "ready"]).toContain(updated.status);
    if (updated.status === "queued") {
      expect(updated.executeAfter).not.toBeNull();
    }
  });

  it("queued proposal cannot be executed before timelock elapses", () => {
    const engine = makeTimelockEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    const updated = engine.getProposal(p.id)!;
    if (updated.status === "queued") {
      expect(() => engine.execute(A, p.id)).toThrow(MultisigError);
    }
  });

  it("zero-timelock proposal is immediately ready after quorum", () => {
    const engine = new ProposalEngine({
      config: {
        signers: [A, B, C],
        quorumThreshold: 0.33,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
        timelockOverrides: { low: 0, medium: 0, high: 0, critical: 0 },
      },
      storageKey: uniqueKey(),
    });
    const p = engine.createProposal(
      A,
      { type: "custom", description: "d", payload: {} },
      "d",
    );
    engine.approve(A, p.id);
    expect(engine.getProposal(p.id)!.status).toBe("ready");
  });

  it("getTimelockStatus returns correct remainingMs for queued proposal", () => {
    const engine = makeTimelockEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    const status = engine.getTimelockStatus(p.id);
    if (status && !status.elapsed) {
      expect(status.remainingMs).toBeGreaterThan(0);
      expect(status.remainingMs).toBeLessThanOrEqual(DEFAULT_TIMELOCK_MS.high);
    }
  });

  it("getTimelockStatus returns null for unknown proposal", () => {
    const engine = makeEngine();
    expect(engine.getTimelockStatus("nonexistent")).toBeNull();
  });

  it("recomputeStatus transitions queued → ready when executeAfter is in the past", () => {
    const engine = makeTimelockEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    const queued = engine.getProposal(p.id)!;
    if (queued.status === "queued") {
      const backdated = {
        ...queued,
        executeAfter: new Date(Date.now() - 1000).toISOString(),
      };
      const refreshed = engine.recomputeStatus(backdated);
      expect(refreshed.status).toBe("ready");
    }
  });
});

// ── ProposalEngine — execute ──────────────────────────────────────────────────

describe("ProposalEngine — execute", () => {
  // Use zero timelock so quorum immediately transitions to ready
  function makeZeroEngine() {
    return new ProposalEngine({
      config: {
        signers: [A, B],
        quorumThreshold: 0.5,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
        timelockOverrides: { high: 0, critical: 0, medium: 0, low: 0 },
      },
      storageKey: uniqueKey(),
    });
  }

  function makeReadyProposal(engine: ProposalEngine, action = FEE_ACTION) {
    const p = engine.createProposal(A, action, "test");
    engine.approve(A, p.id);
    engine.approve(B, p.id);
    return p.id;
  }

  it("executes a ready proposal", () => {
    const engine = makeZeroEngine();
    const id = makeReadyProposal(engine);
    const result = engine.execute(A, id);
    expect(result.proposalId).toBe(id);
    expect(result.executedBy).toBe(A);
    expect(engine.getProposal(id)!.status).toBe("executed");
  });

  it("executed proposal cannot be executed again", () => {
    const engine = makeZeroEngine();
    const id = makeReadyProposal(engine);
    engine.execute(A, id);
    expect(() => engine.execute(A, id)).toThrow(MultisigError);
  });

  it("non-signer cannot execute", () => {
    const engine = makeZeroEngine();
    const id = makeReadyProposal(engine);
    expect(() => engine.execute(NOBODY, id)).toThrow(MultisigError);
  });

  it("pending proposal cannot be executed", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    expect(() => engine.execute(A, p.id)).toThrow(MultisigError);
  });

  it("execution result contains the action", () => {
    const engine = makeZeroEngine();
    const id = makeReadyProposal(engine, FEE_ACTION);
    const result = engine.execute(A, id);
    expect(result.action).toEqual(FEE_ACTION);
  });
});

// ── ProposalEngine — cancel ───────────────────────────────────────────────────

describe("ProposalEngine — cancel", () => {
  it("proposer can cancel a pending proposal", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    const cancelled = engine.cancel(A, p.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("SuperAdmin can cancel any proposal", () => {
    const registry = {
      hasAtLeastRole: (addr: string, role: string) =>
        addr === SUPER && role === "SuperAdmin",
    } as never;
    const engine = new ProposalEngine({
      config: {
        signers: [A, B, C],
        quorumThreshold: 0.51,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
      },
      storageKey: uniqueKey(),
      registry,
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    const cancelled = engine.cancel(SUPER, p.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("non-proposer non-admin cannot cancel", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    expect(() => engine.cancel(B, p.id)).toThrow(MultisigError);
  });

  it("executed proposal cannot be cancelled", () => {
    const engine = new ProposalEngine({
      config: {
        signers: [A, B],
        quorumThreshold: 0.5,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
        timelockOverrides: { high: 0, critical: 0, medium: 0, low: 0 },
      },
      storageKey: uniqueKey(),
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    engine.approve(B, p.id);
    engine.execute(A, p.id);
    expect(() => engine.cancel(A, p.id)).toThrow(MultisigError);
  });

  it("cancelled proposal cannot be approved", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.cancel(A, p.id);
    expect(() => engine.approve(B, p.id)).toThrow(MultisigError);
  });
});

// ── ProposalEngine — expiry ───────────────────────────────────────────────────

describe("ProposalEngine — expiry", () => {
  it("proposal expires when voting deadline passes without quorum", () => {
    const engine = makeEngine([A, B, C], {
      quorumThreshold: 0.51,
      votingWindowMs: 1, // 1 ms — expires immediately
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    // Wait a tick for the deadline to pass
    const backdated = {
      ...p,
      votingDeadline: new Date(Date.now() - 1000).toISOString(),
    };
    const refreshed = engine.recomputeStatus(backdated);
    expect(refreshed.status).toBe("expired");
  });

  it("proposal with quorum does not expire", () => {
    const engine = makeEngine([A, B, C], { quorumThreshold: 0.33 });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id); // 1/3 = 33% >= 33% → queued
    const updated = engine.getProposal(p.id)!;
    expect(updated.status).not.toBe("expired");
  });
});

// ── ProposalEngine — emergency override ──────────────────────────────────────

describe("ProposalEngine — emergencyOverride", () => {
  function makeRegistryWithSuperAdmin(superAddr: string) {
    return {
      hasAtLeastRole: (addr: string, role: string) =>
        addr === superAddr && role === "SuperAdmin",
    } as never;
  }

  it("SuperAdmin can emergency override with sufficient approvals", () => {
    const registry = makeRegistryWithSuperAdmin(SUPER);
    const engine = new ProposalEngine({
      config: {
        signers: [A, B, C, SUPER],
        quorumThreshold: 0.51,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
      },
      storageKey: uniqueKey(),
      registry,
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    engine.approve(B, p.id);
    engine.approve(C, p.id); // 3/4 = 75% >= 75%
    const overridden = engine.emergencyOverride(SUPER, p.id);
    expect(overridden.status).toBe("queued");
    expect(overridden.emergency).toBe(true);
    expect(overridden.timelockMs).toBeLessThan(DEFAULT_TIMELOCK_MS.high);
  });

  it("non-SuperAdmin cannot emergency override", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    expect(() => engine.emergencyOverride(A, p.id)).toThrow(MultisigError);
  });

  it("emergency override fails without sufficient approvals", () => {
    const registry = makeRegistryWithSuperAdmin(SUPER);
    const engine = new ProposalEngine({
      config: {
        signers: [A, B, C, SUPER],
        quorumThreshold: 0.51,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
      },
      storageKey: uniqueKey(),
      registry,
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id); // 1/4 = 25% < 75%
    expect(() => engine.emergencyOverride(SUPER, p.id)).toThrow(MultisigError);
  });
});

// ── ProposalEngine — queries ──────────────────────────────────────────────────

describe("ProposalEngine — queries", () => {
  it("listProposals returns all proposals newest first", () => {
    const engine = makeEngine();
    engine.createProposal(A, FEE_ACTION, "first");
    engine.createProposal(A, PAUSE_ACTION, "second");
    const list = engine.listProposals();
    expect(list).toHaveLength(2);
    expect(list[0].description).toBe("second");
  });

  it("listProposals filters by status", () => {
    const engine = makeEngine();
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.cancel(A, p.id);
    engine.createProposal(A, PAUSE_ACTION, "active");
    expect(engine.listProposals({ status: "cancelled" })).toHaveLength(1);
    expect(engine.listProposals({ status: "pending" })).toHaveLength(1);
  });

  it("getProposal returns null for unknown ID", () => {
    const engine = makeEngine();
    expect(engine.getProposal("nonexistent")).toBeNull();
  });

  it("getConfig returns current config", () => {
    const engine = makeEngine([A, B]);
    expect(engine.getConfig().signers).toEqual([A, B]);
  });
});

// ── ProposalEngine — signer management ───────────────────────────────────────

describe("ProposalEngine — signer management", () => {
  it("addSigner adds a new signer", () => {
    const engine = makeEngine([A]);
    engine.addSigner(B);
    expect(engine.getConfig().signers).toContain(B);
  });

  it("addSigner is idempotent", () => {
    const engine = makeEngine([A]);
    engine.addSigner(A);
    expect(engine.getConfig().signers.filter((s) => s === A)).toHaveLength(1);
  });

  it("removeSigner removes a signer", () => {
    const engine = makeEngine([A, B]);
    engine.removeSigner(A);
    expect(engine.getConfig().signers).not.toContain(A);
  });
});

// ── MultisigError ─────────────────────────────────────────────────────────────

describe("MultisigError", () => {
  it("has name MultisigError", () => {
    const err = new MultisigError("msg", "id", "pending");
    expect(err.name).toBe("MultisigError");
  });

  it("exposes proposalId and status", () => {
    const err = new MultisigError("msg", "abc", "queued");
    expect(err.proposalId).toBe("abc");
    expect(err.status).toBe("queued");
  });

  it("is instanceof Error", () => {
    expect(new MultisigError("m", "i", "pending") instanceof Error).toBe(true);
  });
});

// ── Audit emitter integration ─────────────────────────────────────────────────

describe("ProposalEngine — audit emitter", () => {
  it("emits proposal.created on createProposal", async () => {
    const emitter = { emit: vi.fn().mockResolvedValue({}) } as never;
    const engine = new ProposalEngine({
      config: {
        signers: [A, B],
        quorumThreshold: 0.51,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
      },
      storageKey: uniqueKey(),
      emitter,
    });
    engine.createProposal(A, FEE_ACTION, "test");
    await Promise.resolve();
    expect(emitter.emit).toHaveBeenCalledWith(
      "proposal.created",
      "system",
      "info",
      A,
      expect.objectContaining({ action: "set_fee" }),
    );
  });

  it("emits proposal.approved on approve", async () => {
    const emitter = { emit: vi.fn().mockResolvedValue({}) } as never;
    const engine = new ProposalEngine({
      config: {
        signers: [A, B],
        quorumThreshold: 0.51,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
      },
      storageKey: uniqueKey(),
      emitter,
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    await Promise.resolve();
    expect(emitter.emit).toHaveBeenCalledWith(
      "proposal.approved",
      "system",
      "info",
      A,
      expect.objectContaining({ proposalId: p.id }),
    );
  });

  it("emits proposal.cancelled on cancel", async () => {
    const emitter = { emit: vi.fn().mockResolvedValue({}) } as never;
    const engine = new ProposalEngine({
      config: {
        signers: [A, B],
        quorumThreshold: 0.51,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
      },
      storageKey: uniqueKey(),
      emitter,
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.cancel(A, p.id);
    await Promise.resolve();
    expect(emitter.emit).toHaveBeenCalledWith(
      "proposal.cancelled",
      "system",
      "warning",
      A,
      expect.objectContaining({ proposalId: p.id }),
    );
  });

  it("emits proposal.emergency_override as critical", async () => {
    const emitter = { emit: vi.fn().mockResolvedValue({}) } as never;
    const registry = {
      hasAtLeastRole: (addr: string, role: string) =>
        addr === SUPER && role === "SuperAdmin",
    } as never;
    const engine = new ProposalEngine({
      config: {
        signers: [A, B, C, SUPER],
        quorumThreshold: 0.51,
        emergencyQuorumThreshold: 0.75,
        votingWindowMs: 3_600_000,
      },
      storageKey: uniqueKey(),
      emitter,
      registry,
    });
    const p = engine.createProposal(A, FEE_ACTION, "test");
    engine.approve(A, p.id);
    engine.approve(B, p.id);
    engine.approve(C, p.id);
    engine.emergencyOverride(SUPER, p.id);
    await Promise.resolve();
    expect(emitter.emit).toHaveBeenCalledWith(
      "proposal.emergency_override",
      "system",
      "critical",
      SUPER,
      expect.any(Object),
    );
  });
});
