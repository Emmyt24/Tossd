import type { Meta, StoryObj } from "@storybook/react";
import { FairnessTimeline } from "./FairnessTimeline";

const meta: Meta<typeof FairnessTimeline> = {
  title: "Sections/FairnessTimeline",
  component: FairnessTimeline,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Ordered list of the three commit-reveal steps: Commit, Reveal, Settle. " +
          "Rendered as an `<ol aria-label='Commit-reveal fairness steps'>` with numbered badges and icons.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FairnessTimeline>;

export const Default: Story = {};
