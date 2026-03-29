import type { Meta, StoryObj } from "@storybook/react";
import { VerificationPanel } from "./VerificationPanel";

const meta: Meta<typeof VerificationPanel> = {
  title: "Sections/VerificationPanel",
  component: VerificationPanel,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Three-section panel for auditing a game outcome: copyable hash fields, " +
          "the payout formula in a `<pre>` block, and a verification checklist. " +
          "Copy buttons use `aria-label` and announce success via state change.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof VerificationPanel>;

export const Default: Story = {};
