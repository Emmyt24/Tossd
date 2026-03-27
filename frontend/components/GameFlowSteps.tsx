import React from "react";
import { StepCard, StepCardProps } from "./StepCard";
import styles from "./GameFlowSteps.module.css";

const STEPS: Omit<StepCardProps, "index">[] = [
  {
    title: "Place Your Bet",
    description: "Choose heads or tails, set your wager, and submit a commitment hash to lock in your move.",
  },
  {
    title: "Reveal Outcome",
    description: "Reveal your secret value. The XOR-based result is computed on-chain — provably fair.",
    state: "success",
  },
  {
    title: "Win or Continue",
    description: "Cash out at 1.9x, or risk your winnings to chase 3.5x → 6x → 10x streak multipliers.",
    state: "warning",
  },
  {
    title: "Lose & Reset",
    description: "A loss forfeits all winnings. Your wager returns to the reserve and the slot is freed.",
    state: "danger",
  },
];

export function GameFlowSteps() {
  return (
    <section aria-label="Game flow steps">
      <ol className={styles.list}>
        {STEPS.map((step, i) => (
          <React.Fragment key={i}>
            <StepCard index={i + 1} {...step} />
            {i < STEPS.length - 1 && (
              <li className={styles.connector} aria-hidden="true" />
            )}
          </React.Fragment>
        ))}
      </ol>
    </section>
  );
}
