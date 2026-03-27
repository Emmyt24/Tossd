import React from "react";
import styles from "./MultiplierProgression.module.css";

const STEPS = ["1.9x", "3.5x", "6x", "10x"];

interface MultiplierProgressionProps {
  /** 0-based index of the currently active multiplier step */
  activeStep?: number;
}

export function MultiplierProgression({ activeStep }: MultiplierProgressionProps) {
  return (
    <ol className={styles.progression} aria-label="Multiplier progression">
      {STEPS.map((label, i) => {
        const isActive = i === activeStep;
        return (
          <React.Fragment key={label}>
            <li
              className={`${styles.step} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              {label}
            </li>
            {i < STEPS.length - 1 && (
              <span className={styles.arrow} aria-hidden="true">→</span>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
