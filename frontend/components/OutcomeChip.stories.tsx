import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { OutcomeChip } from "./OutcomeChip";

const meta: Meta<typeof OutcomeChip> = {
  title: "Primitives/OutcomeChip",
  component: OutcomeChip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Small status chip indicating a game outcome. Uses `role='status'` with an " +
          "`aria-label` so screen readers announce the full outcome string.",
      },
    },
  },
  argTypes: {
    state: { control: "radio", options: ["win", "loss", "pending"] },
  },
};

export default meta;
type Story = StoryObj<typeof OutcomeChip>;

export const Win: Story = { args: { state: "win" } };
export const Loss: Story = { args: { state: "loss" } };
export const Pending: Story = { args: { state: "pending" } };

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "12px" }}>
      <OutcomeChip state="win" />
      <OutcomeChip state="loss" />
      <OutcomeChip state="pending" />
    </div>
  ),
};
