import type { Meta, StoryObj } from "@storybook/react";
import { EconomicsPanel } from "./EconomicsPanel";

const meta: Meta<typeof EconomicsPanel> = {
  title: "Sections/EconomicsPanel",
  component: EconomicsPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Three-panel section covering the fee model formula, an example payout table (3% fee), " +
          "and reserve solvency rules. The payout table uses semantic `<table>` with `scope` attributes.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EconomicsPanel>;

export const Default: Story = {};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
