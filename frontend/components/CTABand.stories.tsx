import type { Meta, StoryObj } from "@storybook/react";
import { CTABand } from "./CTABand";

const meta: Meta<typeof CTABand> = {
  title: "Sections/CTABand",
  component: CTABand,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-width call-to-action band with a heading and two action links. " +
          "The section is labelled via `aria-labelledby` pointing to the visible heading.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CTABand>;

export const Default: Story = {};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
