import React, { useState, useCallback } from "react";
import styles from "./VerificationPanel.module.css";

interface HashFieldProps {
  label: string;
  value: string;
}

function HashField({ label, value }: HashFieldProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div className={styles.field}>
      <p className={styles.label}>{label}</p>
      <div className={styles.hashRow}>
        <p className={styles.hash} title={value}>{value}</p>
        <button
          className={styles.copyBtn}
          onClick={copy}
          aria-label={`Copy ${label}`}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const HASH_FIELDS = [
  { label: "Commit hash", value: "0x3a7fc2d8e1b94f05a6c3d7e2f1b8a9c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0" },
  { label: "Reveal secret", value: "0x8d2e4f1a9b3c7e5d2f8a1b4c9e3d7f2a5b8c1e4d7f0a3b6c9e2d5f8a1b4c7e0" },
  { label: "Transaction ID", value: "0xf19c3a7e2b5d8f1a4c7e0b3d6f9a2c5e8b1d4f7a0c3e6b9d2f5a8c1e4b7d0f3" },
];

const CHECKLIST = [
  "Locate the commit hash in the transaction that called start_game.",
  "Confirm the reveal secret hashes to the stored commitment on-chain.",
  "Verify the XOR of both secrets matches the reported outcome.",
];

export function VerificationPanel() {
  return (
    <div className={styles.panel}>
      <div>
        <p className={styles.sectionTitle}>Hash fields</p>
        <div className={styles.fields}>
          {HASH_FIELDS.map((f) => (
            <HashField key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      </div>

      <div>
        <p className={styles.sectionTitle}>Payout formula</p>
        <pre className={styles.formula}>
          <span>gross = wager × multiplier_bps / 10_000{"\n"}</span>
          <span>fee   = gross × fee_bps / 10_000{"\n"}</span>
          <span>net   = gross − fee{"\n"}</span>
          <span className={styles.formulaComment}>{"\n"}// All arithmetic uses checked_* — no silent overflow</span>
        </pre>
      </div>

      <div>
        <p className={styles.sectionTitle}>How to verify</p>
        <ul className={styles.checklist} aria-label="Verification steps">
          {CHECKLIST.map((item) => (
            <li key={item} className={styles.checkItem}>
              <span className={styles.checkMark} aria-hidden="true">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
