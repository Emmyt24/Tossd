/**
 * Low-level cryptographic utilities used by HSM providers.
 *
 * All operations use the browser's SubtleCrypto API so no raw key material
 * ever leaves the secure context. Functions here are pure helpers with no
 * side effects on HSM state.
 */

// ── Encoding helpers ──────────────────────────────────────────────────────────

/** Convert a hex string to a Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${clean.length}`);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert a Uint8Array to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert a Uint8Array to a base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/** Convert a base64 string to a Uint8Array. */
export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of the given bytes.
 * Returns raw 32-byte digest.
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

/**
 * Compute SHA-256 of `message || context` where context is UTF-8 encoded.
 * Used for domain-separated signing.
 */
export async function sha256WithContext(
  message: Uint8Array,
  context: string,
): Promise<Uint8Array> {
  const contextBytes = new TextEncoder().encode(context);
  const combined = new Uint8Array(message.length + contextBytes.length);
  combined.set(message, 0);
  combined.set(contextBytes, message.length);
  return sha256(combined);
}

// ── Entropy ───────────────────────────────────────────────────────────────────

/**
 * Generate `n` cryptographically random bytes using the browser CSPRNG.
 * Throws if the environment does not provide a secure random source.
 */
export function randomBytes(n: number): Uint8Array {
  if (!crypto || !crypto.getRandomValues) {
    throw new Error("Secure random source unavailable in this environment");
  }
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

/**
 * Mix additional entropy into a base buffer using XOR.
 * Used to combine HSM-generated entropy with caller-supplied context.
 */
export function xorMix(base: Uint8Array, extra: Uint8Array): Uint8Array {
  const result = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) {
    result[i] = base[i] ^ extra[i % extra.length];
  }
  return result;
}

// ── Key derivation ────────────────────────────────────────────────────────────

/**
 * Derive an AES-256-GCM wrapping key from a passphrase using PBKDF2.
 *
 * @param passphrase  - User-supplied passphrase (UTF-8)
 * @param salt        - 16-byte random salt
 * @param iterations  - PBKDF2 iteration count (default: 310_000 per OWASP 2023)
 */
export async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = 310_000,
): Promise<CryptoKey> {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ── AES-GCM encryption ────────────────────────────────────────────────────────

/**
 * Encrypt raw bytes with AES-256-GCM.
 * Returns `{ ciphertext, iv }` — both as Uint8Array.
 */
export async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = randomBytes(12); // 96-bit IV recommended for AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Throws `DOMException` if authentication tag verification fails.
 */
export async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey,
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}

// ── Commitment helpers ────────────────────────────────────────────────────────

/**
 * Validate that a 32-byte commitment has sufficient entropy.
 *
 * Mirrors the on-chain `WeakCommitment` check in the Soroban contract:
 * rejects all-zero and all-same-byte patterns.
 */
export function validateCommitmentEntropy(commitment: Uint8Array): boolean {
  if (commitment.length !== 32) return false;
  const first = commitment[0];
  return !commitment.every((b) => b === first);
}

/**
 * Format a 32-byte array as a `0x`-prefixed hex string suitable for
 * passing to the Soroban SDK as `BytesN<32>`.
 */
export function toBytes32Hex(bytes: Uint8Array): string {
  if (bytes.length !== 32) {
    throw new Error(`Expected 32 bytes, got ${bytes.length}`);
  }
  return "0x" + bytesToHex(bytes);
}
