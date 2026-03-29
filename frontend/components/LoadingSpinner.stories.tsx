import type { Meta, StoryObj } from "@storybook/react";
import { LoadingSpinner } from "./LoadingSpinner";

const meta: Meta<typeof LoadingSpinner> = {
  title: "Primitives/LoadingSpinner",
  component: LoadingSpinner,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Accessible spinner with `role='status'` and a visually-hidden label. " +
          "Respects `prefers-reduced-motion` — swaps the spinning ring for a pulsing dot.",
      },
    },
  },
  argTypes: {
    size: { control: "radio", options: ["small", "medium", "large"] },
    mode: { control: "radio", options: ["inline", "overlay"] },
    label: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

export const Small: Story = { args: { size: "small" } };
export const Medium: Story = { args: { size: "medium" } };
export const Large: Story = { args: { size: "large" } };
export const Overlay: Story = {
  args: { size: "medium", mode: "overlay", label: "Processing transaction…" },
  parameters: { layout: "fullscreen" },
};
export const CustomLabel: Story = {
  args: { size: "medium", label: "Waiting for block confirmation…" },
};
