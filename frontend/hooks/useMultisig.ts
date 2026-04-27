/**
 * useMultisig — React hook for the multisig + timelock system.
 *
 * Initialises the engine and clock on mount, exposes proposal management
 * actions, and provides live proposal lists that re-render on changes.
 *
 * ## Usage
 * ```tsx
 * const { proposals, createProposal, approve, execute } = useMultisig({
 *   signers: [adminA, adminB, adminC],
 *   currentAddress: walletAddress,
 * });
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMultisig,
  ProposalEngine,
  TimelockClock,
  MultisigError,
} from "../multisig";
import type {
  Proposal,
  ProposalAction,
  ProposalStatus,
  MultisigConfig,
  TimelockStatus,
} from "../multisig/types";
import type { SecurityEventEmitter } from "../security/SecurityEventEmitter";
import type { RoleRegistry } from "../rbac/RoleRegistry";

// ── Hook options ──────────────────────────────────────────────────────────────

export interface UseMultisigOptions {
  signers: string[];
  currentAddress: string | null;
  config?: Partial<MultisigConfig>;
  emitter?: SecurityEventEmitter | null;
  registry?: RoleRegistry | null;
  storageKey?: string;
  /** Clock poll interval in ms (default: 5000). */
  pollIntervalMs?: number;
}

// ── Hook result ───────────────────────────────────────────────────────────────

export interface UseMultisigResult {
  engine: ProposalEngine | null;
  ready: boolean;
  /** All proposals (refreshed on every action). */
  proposals: Proposal[];
  /** Active timelock countdowns. */
  timelocks: TimelockStatus[];
  /** Last error message. */
  error: string | null;
  /** Create a new proposal. */
  createProposal(
    action: ProposalAction,
    description: string,
    emergency?: boolean,
  ): Proposal | null;
  /** Approve a proposal. */
  approve(proposalId: string, comment?: string): Proposal | null;
  /** Reject a proposal. */
  reject(proposalId: string, reason?: string): Proposal | null;
  /** Execute a ready proposal. */
  execute(proposalId: string): Proposal | null;
  /** Cancel a proposal. */
  cancel(proposalId: string, reason?: string): Proposal | null;
  /** Emergency override (SuperAdmin only). */
  emergencyOverride(proposalId: string): Proposal | null;
  /** Filter proposals by status. */
  filterByStatus(status: ProposalStatus): Proposal[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMultisig({
  signers,
  currentAddress,
  config,
  emitter,
  registry,
  storageKey,
  pollIntervalMs = 5_000,
}: UseMultisigOptions): UseMultisigResult {
  const engineRef = useRef<ProposalEngine | null>(null);
  const clockRef = useRef<TimelockClock | null>(null);

  const [ready, setReady] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [timelocks, setTimelocks] = useState<TimelockStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const engine = engineRef.current;
    const clock = clockRef.current;
    if (!engine) return;
    setProposals(engine.listProposals());
    setTimelocks(clock?.getActiveTimelocks() ?? []);
  }, []);

  // Initialise engine + clock
  useEffect(() => {
    const { engine, clock } = createMultisig(
      signers,
      { ...config, storageKey } as Partial<MultisigConfig>,
      emitter,
      registry,
    );

    engineRef.current = engine;
    clockRef.current = clock;

    // Fire refresh on timelock transitions
    clock.onTimelockReady(() => refresh());
    clock.onTimelockExpired(() => refresh());

    clock.start();
    setReady(true);
    refresh();

    return () => {
      clock.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Keep signers in sync without re-initialising
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.updateConfig({ signers });
    refresh();
  }, [signers, refresh]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const createProposal = useCallback(
    (
      action: ProposalAction,
      description: string,
      emergency = false,
    ): Proposal | null => {
      if (!currentAddress || !engineRef.current) return null;
      try {
        const p = engineRef.current.createProposal(
          currentAddress,
          action,
          description,
          emergency,
        );
        refresh();
        setError(null);
        return p;
      } catch (err) {
        setError(err instanceof MultisigError ? err.message : String(err));
        return null;
      }
    },
    [currentAddress, refresh],
  );

  const approve = useCallback(
    (proposalId: string, comment?: string): Proposal | null => {
      if (!currentAddress || !engineRef.current) return null;
      try {
        const p = engineRef.current.approve(
          currentAddress,
          proposalId,
          comment,
        );
        refresh();
        setError(null);
        return p;
      } catch (err) {
        setError(err instanceof MultisigError ? err.message : String(err));
        return null;
      }
    },
    [currentAddress, refresh],
  );

  const reject = useCallback(
    (proposalId: string, reason?: string): Proposal | null => {
      if (!currentAddress || !engineRef.current) return null;
      try {
        const p = engineRef.current.reject(currentAddress, proposalId, reason);
        refresh();
        setError(null);
        return p;
      } catch (err) {
        setError(err instanceof MultisigError ? err.message : String(err));
        return null;
      }
    },
    [currentAddress, refresh],
  );

  const execute = useCallback(
    (proposalId: string): Proposal | null => {
      if (!currentAddress || !engineRef.current) return null;
      try {
        engineRef.current.execute(currentAddress, proposalId);
        refresh();
        setError(null);
        return engineRef.current.getProposal(proposalId);
      } catch (err) {
        setError(err instanceof MultisigError ? err.message : String(err));
        return null;
      }
    },
    [currentAddress, refresh],
  );

  const cancel = useCallback(
    (proposalId: string, reason?: string): Proposal | null => {
      if (!currentAddress || !engineRef.current) return null;
      try {
        const p = engineRef.current.cancel(currentAddress, proposalId, reason);
        refresh();
        setError(null);
        return p;
      } catch (err) {
        setError(err instanceof MultisigError ? err.message : String(err));
        return null;
      }
    },
    [currentAddress, refresh],
  );

  const emergencyOverride = useCallback(
    (proposalId: string): Proposal | null => {
      if (!currentAddress || !engineRef.current) return null;
      try {
        const p = engineRef.current.emergencyOverride(
          currentAddress,
          proposalId,
        );
        refresh();
        setError(null);
        return p;
      } catch (err) {
        setError(err instanceof MultisigError ? err.message : String(err));
        return null;
      }
    },
    [currentAddress, refresh],
  );

  const filterByStatus = useCallback(
    (status: ProposalStatus): Proposal[] =>
      proposals.filter((p) => p.status === status),
    [proposals],
  );

  return {
    engine: engineRef.current,
    ready,
    proposals,
    timelocks,
    error,
    createProposal,
    approve,
    reject,
    execute,
    cancel,
    emergencyOverride,
    filterByStatus,
  };
}
