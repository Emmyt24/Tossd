import type { Meta, StoryObj } from "@storybook/react";
import { GameStateCard, GameState } from "./GameStateCard";

const meta: Meta<typeof GameStateCard> = {
  title: "Game/GameStateCard",
  component: GameStateCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Live game state display. Shows wager, current multiplier, streak, and phase-appropriate " +
          "action buttons (Reveal / Cash Out / Continue Streak). Uses `aria-live='polite'` so " +
          "state transitions are announced to screen readers.",
      },
    },
  },
  argTypes: {
    loading: { control: "boolean" },
    onReveal: { action: "reveal" },
    onCashOut: { action: "cashOut" },
    onContinue: { action: "continue" },
  },
};

export default meta;
type Story = StoryObj<typeof GameStateCard>;

const baseGame: GameState = { phase: "idle", side: "heads", wagerStroops: 10_000_000, streak: 0 };

export const Idle: Story = { args: { game: null } };

export const Committed: Story = {
  args: {
    game: { ...baseGame, phase: "committed", pendingTx: "abc123...def456" },
    onReveal: () => {},
  },
};

export const Won: Story = {
  args: {
    game: { ...baseGame, phase: "won", streak: 1 },
    onCashOut: () => {}, onContinue: () => {},
  },
};

export const Lost: Story = {
  args: { game: { ...baseGame, phase: "lost" } },
};

export const TimedOut: Story = {
  args: { game: { ...baseGame, phase: "timed_out" } },
};

export const Loading: Story = {
  args: {
    game: { ...baseGame, phase: "committed" },
    loading: true,
    onReveal: () => {},
  },
};
