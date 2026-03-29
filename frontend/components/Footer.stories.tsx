import type { Meta, StoryObj } from "@storybook/react";
import { Footer } from "./Footer";

const meta: Meta<typeof Footer> = {
  title: "Layout/Footer",
  component: Footer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Site footer with brand column, navigation, resources, social links, legal links, and disclaimer. " +
          "Social links use `aria-label` for icon-only buttons. External links include `rel='noopener noreferrer'`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
