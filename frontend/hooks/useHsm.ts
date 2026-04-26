/**
 * useHsm — React hook for HSM provider lifecycle management.
 *
 * Initialises the HSM provider on mount, exposes key management helpers,
 * and surfaces health status for the UI. The provider instance is stable
 * across renders (created once, stored in a ref).
 *
 * ## Usage
 * ```tsx
 * const { hsm, ready, health, generateCommitment } = useHsm();
 *
 * const commitment = await generateCommitment({ context: walletAddress });
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createHsmProvider,
  HsmProvider,
  HsmKeyHandle,
  HsmHealthStatus,
  CommitmentRequest,
  CommitmentResult,
  KeyAlgorithm,
  KeyUsage,
} from "../hsm";

// ── Hook state ────────────────────────────────────────────────────────────────

export interface UseHsmState {
  /** The HSM provider instance (null until initialised). */
  hsm: HsmProvider | null;
  /** True once the provider has been initialised and is available. */
  ready: boolean;
  /** Latest health status snapshot. */
  health: HsmHealthStatus | null;
  /** Non-null when initialisation or a health check fails. */
  error: string | null;
}

export interface UseHsmActions {
  /** Generate a new key pair inside the HSM. */
  generateKey(algorithm: KeyAlgorithm, usage: KeyUsage): Promise<HsmKeyHandle>;
  /** Generate a commitment secret using the HSM. */
  generateCommitment(request?: CommitmentRequest): Promise<CommitmentResult>;
  /** Refresh the health status snapshot. */
  refreshHealth(): Promise<void>;
}

export type UseHsmResult = UseHsmState & UseHsmActions;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHsm(
  options: {
    bridgeUrl?: string;
    authToken?: string;
    /** Auto-generate a signing key on first mount (default: false). */
    autoGenerateKey?: boolean;
  } = {},
): UseHsmResult {
  const providerRef = useRef<HsmProvider | null>(null);

  const [ready, setReady] = useState(false);
  const [health, setHealth] = useState<HsmHealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialise the provider once on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const provider = createHsmProvider({
          bridgeUrl: options.bridgeUrl,
          authToken: options.authToken,
        });

        const available = await provider.isAvailable();
        if (!available) {
          throw new Error("HSM provider is not available in this environment");
        }

        if (!cancelled) {
          providerRef.current = provider;
          setReady(true);
          setError(null);

          // Initial health snapshot
          const keys = await provider.listKeys().catch(() => []);
          setHealth({
            available: true,
            providerName: provider.name,
            activeKeyCount: keys.filter((k) => k.active).length,
            lastCheckedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setReady(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.bridgeUrl, options.authToken]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const generateKey = useCallback(
    async (algorithm: KeyAlgorithm, usage: KeyUsage): Promise<HsmKeyHandle> => {
      if (!providerRef.current) {
        throw new Error("HSM provider not initialised");
      }
      return providerRef.current.generateKey(algorithm, usage);
    },
    [],
  );

  const generateCommitment = useCallback(
    async (request: CommitmentRequest = {}): Promise<CommitmentResult> => {
      if (!providerRef.current) {
        throw new Error("HSM provider not initialised");
      }
      return providerRef.current.generateCommitment(request);
    },
    [],
  );

  const refreshHealth = useCallback(async (): Promise<void> => {
    const provider = providerRef.current;
    if (!provider) return;

    try {
      const [available, keys] = await Promise.all([
        provider.isAvailable(),
        provider.listKeys().catch(() => []),
      ]);

      setHealth({
        available,
        providerName: provider.name,
        activeKeyCount: keys.filter((k) => k.active).length,
        lastCheckedAt: new Date().toISOString(),
        errorMessage: available ? undefined : "Provider unavailable",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHealth((prev) =>
        prev
          ? {
              ...prev,
              available: false,
              errorMessage: message,
              lastCheckedAt: new Date().toISOString(),
            }
          : null,
      );
    }
  }, []);

  return {
    hsm: providerRef.current,
    ready,
    health,
    error,
    generateKey,
    generateCommitment,
    refreshHealth,
  };
}
