/**
 * HSM module public API
 *
 * Re-exports all public types and classes. Import from this barrel file
 * rather than individual modules to keep import paths stable.
 *
 * ```ts
 * import { createHsmProvider, HsmContractAdapter } from "../hsm";
 * ```
 */

// Types
export type {
  KeyAlgorithm,
  KeyUsage,
  HsmKeyHandle,
  HsmPublicKey,
  SignRequest,
  SignResult,
  CommitmentRequest,
  CommitmentResult,
  EncryptedKeyRecord,
  HsmProvider,
  HsmHealthStatus,
} from "./types";

// Providers
export { WebCryptoHsmProvider } from "./WebCryptoHsmProvider";
export { HardwareHsmProvider } from "./HardwareHsmProvider";
export { FailoverHsmProvider } from "./FailoverHsmProvider";
export type { FailoverEvent, FailoverListener } from "./FailoverHsmProvider";

// Storage
export { SecureKeyStorage } from "./SecureKeyStorage";

// Contract adapter
export { HsmContractAdapter } from "./HsmContractAdapter";
export type {
  HsmAuditEntry,
  HsmContractAdapterOptions,
} from "./HsmContractAdapter";

// Crypto utilities (low-level; use sparingly outside the hsm module)
export {
  sha256,
  sha256WithContext,
  randomBytes,
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  validateCommitmentEntropy,
  toBytes32Hex,
} from "./crypto";

// ── Factory helpers ───────────────────────────────────────────────────────────

import { WebCryptoHsmProvider } from "./WebCryptoHsmProvider";
import { HardwareHsmProvider } from "./HardwareHsmProvider";
import { FailoverHsmProvider } from "./FailoverHsmProvider";
import type { HsmProvider } from "./types";

/**
 * Create the recommended HSM provider for the current environment.
 *
 * - In production (VITE_HSM_BRIDGE_URL is set): returns a FailoverHsmProvider
 *   that tries the hardware HSM first and falls back to WebCrypto.
 * - In development / test: returns a WebCryptoHsmProvider directly.
 *
 * @param options.bridgeUrl   - HSM bridge service URL (overrides env var)
 * @param options.authToken   - Bridge auth token (overrides env var)
 * @param options.probeIntervalMs - How often to re-probe the primary (ms)
 */
export function createHsmProvider(
  options: {
    bridgeUrl?: string;
    authToken?: string;
    probeIntervalMs?: number;
  } = {},
): HsmProvider {
  const bridgeUrl =
    options.bridgeUrl ??
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string> }).env
          ?.VITE_HSM_BRIDGE_URL
      : undefined);

  const authToken =
    options.authToken ??
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string> }).env
          ?.VITE_HSM_AUTH_TOKEN
      : undefined);

  const softwareProvider = new WebCryptoHsmProvider();

  if (bridgeUrl && authToken) {
    const hardwareProvider = new HardwareHsmProvider({
      baseUrl: bridgeUrl,
      authToken,
    });
    return new FailoverHsmProvider(hardwareProvider, softwareProvider, {
      probeIntervalMs: options.probeIntervalMs,
    });
  }

  // No bridge configured — use software provider
  return softwareProvider;
}
