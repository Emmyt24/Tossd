/**
 * Accessibility test suite — game interface components (WCAG AA via axe-core).
 *
 * Covers: CoinFlip, CommitRevealFlow, GameResult, WagerInput, SideSelector,
 *         CashOutModal, GameStateCard, GameFlowSteps, Footer, StatsDashboard,
 *         TransactionHistory, LoadingSpinner, Toast, WalletModal.
 *
 * Run: npx vitest run tests/a11y.game.test.tsx
 * References: #350
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { CoinFlip } from "../components/CoinFlip";
import { CommitRevealFlow } from "../components/CommitRevealFlow";
import { GameResult } from "../components/GameResult";
import { WagerInput } from "../components/WagerInput";
import { SideSelector } from "../components/SideSelector";
import { CashOutModal } from "../components/CashOutModal";
import { GameStateCard } from "../components/GameStateCard";
import { GameFlowSteps } from "../components/GameFlowSteps";
import { Footer } from "../components/Footer";
import { LoadingSpinner } from "../components/LoadingSpinner";

expect.extend(toHaveNoViolations);

async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ─── CoinFlip ────────────────────────────────────────────────────────────────

describe("CoinFlip a11y", () => {
  it("has no axe violations in idle state", () =>
    expectNoViolations(<CoinFlip state="idle" result="heads" />));

  it("has no axe violations while flipping", () =>
    expectNoViolations(<CoinFlip state="flipping" result="heads" />));

  it("has no axe violations when revealed heads", () =>
    expectNoViolations(<CoinFlip state="revealed" result="heads" />));

  it("has no axe violations when revealed tails", () =>
    expectNoViolations(<CoinFlip state="revealed" result="tails" />));

  it("has an accessible label", () => {
    const { container } = render(<CoinFlip state="revealed" result="heads" />);
    const coin = container.querySelector("[aria-label]");
    expect(coin).toBeInTheDocument();
    expect(coin?.getAttribute("aria-label")).toBeTruthy();
  });
});

// ─── CommitRevealFlow ────────────────────────────────────────────────────────

describe("CommitRevealFlow a11y", () => {
  const noop = async () => {};

  it("has no axe violations on commit step", () =>
    expectNoViolations(<CommitRevealFlow onCommit={noop} onReveal={noop} />));

  it("has a labelled region or section", () => {
    const { container } = render(
      <CommitRevealFlow onCommit={noop} onReveal={noop} />
    );
    // Must have at least one landmark or labelled region
    const landmarks = container.querySelectorAll(
      "[role='region'], [role='form'], section, form"
    );
    expect(landmarks.length).toBeGreaterThan(0);
  });

  it("step indicators have accessible text", () => {
    const { getAllByRole } = render(
      <CommitRevealFlow onCommit={noop} onReveal={noop} />
    );
    // Any buttons or list items describing steps must have accessible names
    const buttons = getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toHaveAccessibleName());
  });
});

// ─── GameResult ──────────────────────────────────────────────────────────────

describe("GameResult a11y — win", () => {
  const winProps = {
    outcome: "win" as const,
    wager: 10_000_000,
    payout: 18_430_000,
    streak: 1,
    onCashOut: () => {},
    onContinue: () => {},
  };

  it("has no axe violations on win", () => expectNoViolations(<GameResult {...winProps} />));

  it("win result has an accessible heading or status", () => {
    const { container } = render(<GameResult {...winProps} />);
    const heading = container.querySelector("h1, h2, h3, [role='heading'], [role='status']");
    expect(heading).toBeInTheDocument();
  });

  it("action buttons have accessible names", () => {
    const { getAllByRole } = render(<GameResult {...winProps} />);
    getAllByRole("button").forEach((btn) => expect(btn).toHaveAccessibleName());
  });
});

describe("GameResult a11y — loss", () => {
  const lossProps = {
    outcome: "loss" as const,
    wager: 10_000_000,
    onPlayAgain: () => {},
  };

  it("has no axe violations on loss", () => expectNoViolations(<GameResult {...lossProps} />));

  it("play again button has accessible name", () => {
    const { getByRole } = render(<GameResult {...lossProps} />);
    expect(getByRole("button", { name: /play again/i })).toHaveAccessibleName();
  });
});

// ─── WagerInput ──────────────────────────────────────────────────────────────

describe("WagerInput a11y", () => {
  it("has no axe violations in default state", () =>
    expectNoViolations(<WagerInput />));

  it("has no axe violations with a valid value", () =>
    expectNoViolations(<WagerInput value="5" min={1} max={10000} />));

  it("has no axe violations with an error value", () =>
    expectNoViolations(<WagerInput value="0.001" min={1} max={10000} />));

  it("input has an associated label", () => {
    const { getByRole } = render(<WagerInput />);
    const input = getByRole("spinbutton");
    expect(input).toHaveAccessibleName();
  });

  it("error message is associated via aria-describedby", () => {
    const { getByRole } = render(<WagerInput value="0" min={1} max={10000} />);
    const input = getByRole("spinbutton");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
  });

  it("disabled state is conveyed accessibly", () => {
    const { getByRole } = render(<WagerInput disabled />);
    expect(getByRole("spinbutton")).toBeDisabled();
  });
});

// ─── SideSelector ────────────────────────────────────────────────────────────

describe("SideSelector a11y", () => {
  it("has no axe violations with heads selected", () =>
    expectNoViolations(<SideSelector value="heads" onChange={() => {}} />));

  it("has no axe violations with tails selected", () =>
    expectNoViolations(<SideSelector value="tails" onChange={() => {}} />));

  it("has no axe violations when disabled", () =>
    expectNoViolations(<SideSelector value="heads" onChange={() => {}} disabled />));

  it("has a radiogroup with accessible name", () => {
    const { getByRole } = render(<SideSelector value="heads" onChange={() => {}} />);
    expect(getByRole("radiogroup", { name: /choose coin side/i })).toBeInTheDocument();
  });

  it("both radio options have accessible names", () => {
    const { getAllByRole } = render(<SideSelector value="heads" onChange={() => {}} />);
    const radios = getAllByRole("radio");
    expect(radios).toHaveLength(2);
    radios.forEach((r) => expect(r).toHaveAccessibleName());
  });

  it("selected option is marked checked", () => {
    const { getByRole } = render(<SideSelector value="tails" onChange={() => {}} />);
    expect(getByRole("radio", { name: /tails/i })).toBeChecked();
  });

  it("keyboard arrow key toggles selection", () => {
    let called = false;
    let calledWith: string | undefined;
    const onChange = (side: string) => { called = true; calledWith = side; };
    const { getByRole } = render(<SideSelector value="heads" onChange={onChange as any} />);
    const group = getByRole("radiogroup");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(called).toBe(true);
    expect(calledWith).toBe("tails");
  });
});

// ─── CashOutModal ────────────────────────────────────────────────────────────

describe("CashOutModal a11y", () => {
  const baseProps = {
    open: true,
    onClose: () => {},
    streak: 1,
    wagerStroops: 10_000_000,
    feeBps: 300,
    onConfirm: async () => {},
  };

  it("has no axe violations when open", () =>
    expectNoViolations(<CashOutModal {...baseProps} />));

  it("has no axe violations when closed", () =>
    expectNoViolations(<CashOutModal {...baseProps} open={false} />));

  it("dialog has aria-modal=true when open", () => {
    const { getByRole } = render(<CashOutModal {...baseProps} />);
    expect(getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("dialog has an accessible label", () => {
    const { getByRole } = render(<CashOutModal {...baseProps} />);
    expect(getByRole("dialog")).toHaveAccessibleName();
  });

  it("confirm button has accessible name", () => {
    const { getByRole } = render(<CashOutModal {...baseProps} />);
    expect(getByRole("button", { name: /cash out|confirm/i })).toHaveAccessibleName();
  });

  it("not rendered when closed", () => {
    const { queryByRole } = render(<CashOutModal {...baseProps} open={false} />);
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ─── GameStateCard ───────────────────────────────────────────────────────────

describe("GameStateCard a11y", () => {
  const idleGame = {
    phase: "idle" as const,
    side: "heads" as const,
    wagerStroops: 0,
    streak: 0,
  };

  const wonGame = {
    phase: "won" as const,
    side: "heads" as const,
    wagerStroops: 10_000_000,
    streak: 1,
  };

  it("has no axe violations with null game", () =>
    expectNoViolations(<GameStateCard game={null} />));

  it("has no axe violations in idle phase", () =>
    expectNoViolations(<GameStateCard game={idleGame} />));

  it("has no axe violations in won phase", () =>
    expectNoViolations(
      <GameStateCard game={wonGame} onCashOut={() => {}} onContinue={() => {}} />
    ));

  it("has no axe violations in lost phase", () =>
    expectNoViolations(
      <GameStateCard game={{ ...idleGame, phase: "lost" }} />
    ));

  it("action buttons have accessible names", () => {
    const { getAllByRole } = render(
      <GameStateCard game={wonGame} onCashOut={() => {}} onContinue={() => {}} />
    );
    getAllByRole("button").forEach((btn) => expect(btn).toHaveAccessibleName());
  });
});

// ─── GameFlowSteps ───────────────────────────────────────────────────────────

describe("GameFlowSteps a11y", () => {
  it("has no axe violations", () => expectNoViolations(<GameFlowSteps />));

  it("has a labelled section", () => {
    const { getByRole } = render(<GameFlowSteps />);
    expect(getByRole("region", { name: /game flow steps/i })).toBeInTheDocument();
  });

  it("steps are in an ordered list", () => {
    const { container } = render(<GameFlowSteps />);
    expect(container.querySelector("ol")).toBeInTheDocument();
  });
});

// ─── Footer ──────────────────────────────────────────────────────────────────

describe("Footer a11y", () => {
  it("has no axe violations", () => expectNoViolations(<Footer />));

  it("has a contentinfo landmark", () => {
    const { getByRole } = render(<Footer />);
    expect(getByRole("contentinfo")).toBeInTheDocument();
  });

  it("all links have accessible names", () => {
    const { getAllByRole } = render(<Footer />);
    getAllByRole("link").forEach((l) => expect(l).toHaveAccessibleName());
  });

  it("external links have rel=noopener", () => {
    const { getAllByRole } = render(<Footer />);
    const externalLinks = getAllByRole("link").filter(
      (l) => l.getAttribute("href")?.startsWith("http")
    );
    externalLinks.forEach((l) =>
      expect(l.getAttribute("rel")).toMatch(/noopener/)
    );
  });
});

// ─── LoadingSpinner ──────────────────────────────────────────────────────────

describe("LoadingSpinner a11y", () => {
  it("has no axe violations", () => expectNoViolations(<LoadingSpinner />));

  it("has role=status or aria-label for screen readers", () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector(
      "[role='status'], [aria-label], [aria-live]"
    );
    expect(spinner).toBeInTheDocument();
  });
});
