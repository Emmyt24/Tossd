/**
 * Hardware HSM Provider
 *
 * Production-grade HSM provider that delegates cryptographic operations to a
 * hardware security module via a PKCS#11 bridge or cloud HSM REST API
 * (AWS CloudHSM, Azure Dedicated HSM, Google Cloud HSM, etc.).
 *
 * This provider communicates with an HSM bridge service running locally or
 * in a sidecar. The bridge exposes a simple JSON-over-HTTP API that translates
 * requests into PKCS#11 / vendor SDK calls.
 *
 * ## Security properties
 * - Private key material never leaves the HSM boundary
 * - All signing operations are performed inside the HSM
 * - The bridge service authenticates requests with a shared HMAC token
 * - TLS is required for all bridge communication (enforced at construction)
 *
 * ## Bridge API contract
 * POST /keys/generate   → { keyId, algorithm, usage, createdAt }
 * POST /keys/import     → { keyId, algorithm, usage, createdAt }
 * GET  /keys/:id/public → { keyId, algorithm, publicKeyHex }
 * POST /keys/:id/sign   → { signatureHex, keyId, algorithm, timestamp }
 * GET  /keys            → [{ keyId, algorithm, usage, createdAt, active }]
 * POST /keys/:id/deactivate → {}
 * POST /commitment      → { secretHex, commitmentHex, commitmentBytes32 }
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
} from "./types";
import { bytesToHex, sha256 } from "./crypto";

// ── Bridge client ─────────────────────────────────────────────────────────────

interface BridgeConfig {
  /** Base URL of the HSM bridge service (must be https:// in production). */
  baseUrl: string;
  /** HMAC-SHA-256 authentication token for bridge requests. */
  authToken: string;
  /** Request timeout in milliseconds (default: 5000). */
  timeoutMs?: number;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class HardwareHsmProvider implements HsmProvider {
  readonly name: string;

  private readonly baseUrl: string;
  private readonly authToken: string;
  private readonly timeoutMs: number;

  constructor(config: BridgeConfig) {
    if (
      !config.baseUrl.startsWith("https://") &&
      !config.baseUrl.startsWith("http://localhost")
    ) {
      throw new Error(
        "HardwareHsmProvider requires HTTPS for the bridge URL (or localhost for development)",
      );
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authToken = config.authToken;
    this.timeoutMs = config.timeoutMs ?? 5_000;
    this.name = `Hardware HSM (${this.baseUrl})`;
  }

  // ── HsmProvider interface ─────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.request<{ status: string }>(
        "GET",
        "/health",
        undefined,
        { timeoutMs: 2_000 },
      );
      return response.status === "ok";
    } catch {
      return false;
    }
  }

  async generateKey(
    algorithm: KeyAlgorithm,
    usage: KeyUsage,
  ): Promise<HsmKeyHandle> {
    return this.request<HsmKeyHandle>("POST", "/keys/generate", {
      algorithm,
      usage,
    });
  }

  async importKey(
    privateKeyHex: string,
    algorithm: KeyAlgorithm,
    usage: KeyUsage,
  ): Promise<HsmKeyHandle> {
    // The bridge accepts the private key hex and wraps it inside the HSM.
    // After this call the raw key material is no longer accessible.
    return this.request<HsmKeyHandle>("POST", "/keys/import", {
      privateKeyHex,
      algorithm,
      usage,
    });
  }

  async exportPublicKey(keyId: string): Promise<HsmPublicKey> {
    return this.request<HsmPublicKey>(
      "GET",
      `/keys/${encodeURIComponent(keyId)}/public`,
    );
  }

  async sign(request: SignRequest): Promise<SignResult> {
    // Send the message as hex; the bridge hashes and signs inside the HSM
    return this.request<SignResult>(
      "POST",
      `/keys/${encodeURIComponent(request.keyId)}/sign`,
      {
        messageHex: bytesToHex(request.message),
        context: request.context,
      },
    );
  }

  async generateCommitment(
    request: CommitmentRequest,
  ): Promise<CommitmentResult> {
    // The HSM generates the secret internally; only the commitment is returned
    return this.request<CommitmentResult>("POST", "/commitment", {
      keyId: request.keyId,
      context: request.context,
    });
  }

  async listKeys(): Promise<HsmKeyHandle[]> {
    return this.request<HsmKeyHandle[]>("GET", "/keys");
  }

  async deactivateKey(keyId: string): Promise<void> {
    await this.request<void>(
      "POST",
      `/keys/${encodeURIComponent(keyId)}/deactivate`,
    );
  }

  // ── HTTP bridge client ────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { timeoutMs?: number } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    // Compute request HMAC for authentication
    const requestId = crypto.randomUUID();
    const timestamp = Date.now().toString();
    const hmacPayload = `${method}:${path}:${timestamp}:${requestId}`;
    const authHeader = await this.computeHmac(hmacPayload);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-HSM-Auth": authHeader,
          "X-Request-Id": requestId,
          "X-Timestamp": timestamp,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => response.statusText);
        throw new Error(`HSM bridge error ${response.status}: ${errorText}`);
      }

      // 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `HSM bridge request timed out after ${timeoutMs}ms: ${method} ${path}`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Compute HMAC-SHA-256 of the payload using the configured auth token.
   * Returns a hex-encoded MAC for use in the X-HSM-Auth header.
   */
  private async computeHmac(payload: string): Promise<string> {
    const keyBytes = new TextEncoder().encode(this.authToken);
    const payloadBytes = new TextEncoder().encode(payload);

    const hmacKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const mac = await crypto.subtle.sign("HMAC", hmacKey, payloadBytes);
    return Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
