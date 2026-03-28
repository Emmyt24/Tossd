import React from "react";
import styles from "./TrustStrip.module.css";

const INDICATORS = [
  {
    label: "Provably Fair Commit-Reveal",
    icon: (
      <svg className={styles.icon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1L2 4v4c0 3.3 2.5 5.7 6 7 3.5-1.3 6-3.7 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M5.5 8l1.8 1.8L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "On-Chain Soroban Settlement",
    icon: (
      <svg className={styles.icon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "2–5% Transparent Fee",
    icon: (
      <svg className={styles.icon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 13L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export function TrustStrip() {
  return (
    <ul className={styles.strip} aria-label="Trust indicators" role="list">
      {INDICATORS.map(({ label, icon }) => (
        <li key={label} className={styles.chip}>
          {icon}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
