import type { Meta, StoryObj } from "@storybook/react";
import { MultiplierProgression } from "./MultiplierProgression";

const meta: Meta<typeof MultiplierProgression> = {
  title: "Primitives/MultiplierProgression",
  component: MultiplierProgression,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Horizontal step indicator showing the four streak multiplier tiers: " +
          "1.9× → 3.5× → 6× → 10×. The active step is highlighted and marked with `aria-current='step'`.",
      },
    },
  },
  argTypes: {
    activeStep: {
      control: { type: "range", min: 0, max: 3, step: 1 },
      description: "0-based index of the currently active multiplier step.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MultiplierProgression>;

export const FirstWin: Story = { args: { activeStep: 0 } };
export const SecondWin: Story = { args: { activeStep: 1 } };
export const ThirdWin: Story = { args: { activeStep: 2 } };
export const MaxStreak: Story = { args: { activeStep: 3 } };
export const NoActive: Story = { args: {} };
