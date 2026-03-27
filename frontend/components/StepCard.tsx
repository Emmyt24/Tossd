import React from "react";
import styles from "./StepCard.module.css";

export type StepState = "success" | "warning" | "danger";

export interface StepCardProps {
  index: number;
  title: string;
  description: string;
  state?: StepState;
}

export function StepCard({ index, title, description, state }: StepCardProps) {
  return (
    <li className={`${styles.card} ${state ? styles[state] : ""}`}>
      <span className={styles.badge}>{String(index).padStart(2, "0")}</span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </li>
  );
}
