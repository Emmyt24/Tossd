import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { StepCard } from "./StepCard";

const meta: Meta<typeof StepCard> = {
  title: "Primitives/StepCard",
  component: StepCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Numbered card used inside `GameFlowSteps`. Supports four visual states: " +
          "default (neutral), success, warning, and danger.",
      },
    },
  },
  argTypes: {
    state: { control: "select", options: [undefined, "success", "warning", "danger"] },
    index: { control: { type: "number", min: 1 } },
    title: { control: "text" },
    description: { control: "text" },
  },
  decorators: [(Story) => <ul style={{ listStyle: "none", padding: 0 }}><Story /></ul>],
};

export default meta;
type Story = StoryObj<typeof StepCard>;

export const Default: Story = {
  args: { index: 1, title: "Place Your Bet", description: "Choose heads or tails and set your wager." },
};
export const Success: Story = {
  args: { index: 2, title: "Reveal Outcome", description: "Reveal your secret. Outcome computed on-chain.", state: "success" },
};
export const Warning: Story = {
  args: { index: 3, title: "Win or Continue", description: "Cash out or risk your winnings for a higher multiplier.", state: "warning" },
};
export const Danger: Story = {
  args: { index: 4, title: "Lose & Reset", description: "A loss forfeits all winnings.", state: "danger" },
};
