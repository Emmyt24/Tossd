import type { Meta, StoryObj } from "@storybook/react";
import { NavBar } from "./NavBar";

const meta: Meta<typeof NavBar> = {
  title: "Layout/NavBar",
  component: NavBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Site header with desktop nav links and a mobile hamburger menu. " +
          "The hamburger button uses `aria-expanded` and `aria-controls`. " +
          "The mobile drawer is a `role='dialog'` with focus trap and Escape-to-close. " +
          "Resize to ≤ 768 px to see the mobile layout.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NavBar>;

export const Desktop: Story = {};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
