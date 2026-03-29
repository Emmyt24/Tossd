import type { Meta, StoryObj } from "@storybook/react";
import { GameResult } from "./GameResult";

const meta: Meta<typeof GameResult> = {
  title: "Game/GameResult",
  component: GameResult,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Full-bleed result card shown after a flip settles. Win state fires a canvas confetti burst. " +
          "Uses `role='status'` with `aria-live='polite'` so screen readers announce the outcome. " +
          "Action buttons adapt based on outcome: Cash Out / Continue Streak for wins, Play Again for losses.",
      },
    },
  },
  argTypes: {
    outcome: { control: "radio", options: ["win", "loss"] },
    wager: { control: { type: "number" } },
    payout: { control: { type: "number" } },
    streak: { control: { type: "range", min: 0, max: 4 } },
    onCashOut: { action: "cashOut" },
    onContinue: { action: "continue" },
    onPlayAgain: { action: "playAgain" },
  },
};

export default meta;
type Story = StoryObj<typeof GameResult>;

export const Win: Story = {
  args: { outcome: "win", wager: 10_000_000, payout: 19_000_000, streak: 0,
    onCashOut: () => {}, onContinue: () => {} },
};

export const WinWithStreak: Story = {
  args: { outcome: "win", wager: 10_000_000, payout: 35_000_000, streak: 1,
    onCashOut: () => {}, onContinue: () => {} },
};

export const Loss: Story = {
  args: { outcome: "loss", wager: 10_000_000, onPlayAgain: () => {} },
};
