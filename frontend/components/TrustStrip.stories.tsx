import type { Meta, StoryObj } from "@storybook/react";
import { TrustStrip } from "./TrustStrip";

const meta: Meta<typeof TrustStrip> = {
  title: "Sections/TrustStrip",
  component: TrustStrip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Horizontal strip of three trust indicator chips with inline SVG icons. " +
          "Rendered as `<ul role='list' aria-label='Trust indicators'>`. Icons are `aria-hidden`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TrustStrip>;

export const Default: Story = {};
