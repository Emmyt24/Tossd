import type { Meta, StoryObj } from "@storybook/react";
import { CoinFlip } from "./CoinFlip";

const meta: Meta<typeof CoinFlip> = {
  title: "Game/CoinFlip",
  component: CoinFlip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "3-D CSS coin animation with three states: idle, flipping, and revealed. " +
          "Uses `aria-live='polite'` and a visually-hidden result announcement for screen readers.",
      },
    },
  },
  argTypes: {
    state: {
      control: "select",
      options: ["idle", "flipping", "revealed"],
      description: "Controls the animation phase of the coin.",
    },
    result: {
      control: "radio",
      options: ["heads", "tails"],
      description: "Which face to show when `state` is `'revealed'`.",
    },
    onAnimationEnd: { action: "animationEnd" },
  },
};

export default meta;
type Story = StoryObj<typeof CoinFlip>;

export const Idle: Story = {
  args: { state: "idle", result: "heads" },
};

export const Flipping: Story = {
  args: { state: "flipping", result: "heads" },
};

export const RevealedHeads: Story = {
  args: { state: "revealed", result: "heads" },
};

export const RevealedTails: Story = {
  args: { state: "revealed", result: "tails" },
};
