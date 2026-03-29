import type { Meta, StoryObj } from "@storybook/react";
import { ProofCard } from "./ProofCard";

const meta: Meta<typeof ProofCard> = {
  title: "Sections/ProofCard",
  component: ProofCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Static mock card used in the hero section to illustrate a completed game: " +
          "wager, chosen side, commit hash, reveal secret, outcome chip, and multiplier.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProofCard>;

export const Default: Story = {};
