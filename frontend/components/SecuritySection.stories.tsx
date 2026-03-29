import type { Meta, StoryObj } from "@storybook/react";
import { SecuritySection } from "./SecuritySection";

const meta: Meta<typeof SecuritySection> = {
  title: "Sections/SecuritySection",
  component: SecuritySection,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Two-column section listing six security features alongside four testing stat cards. " +
          "Feature list uses `role='list'` and stat cards are grouped with `aria-label='Testing statistics'`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SecuritySection>;

export const Default: Story = {};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
