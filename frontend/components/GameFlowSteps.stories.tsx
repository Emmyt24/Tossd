import type { Meta, StoryObj } from "@storybook/react";
import { GameFlowSteps } from "./GameFlowSteps";

const meta: Meta<typeof GameFlowSteps> = {
  title: "Sections/GameFlowSteps",
  component: GameFlowSteps,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Ordered list of four `StepCard` components illustrating the game flow: " +
          "Place Bet → Reveal → Win/Continue → Lose/Reset. " +
          "Connectors between cards are `aria-hidden`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GameFlowSteps>;

export const Default: Story = {};
