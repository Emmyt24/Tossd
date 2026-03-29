import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SideSelector, CoinSide } from "./SideSelector";

const meta: Meta<typeof SideSelector> = {
  title: "Forms/SideSelector",
  component: SideSelector,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Radio-group for choosing Heads or Tails. Keyboard-navigable with ArrowLeft/ArrowRight. " +
          "Uses `role='radiogroup'` with hidden radio inputs for full screen-reader compatibility.",
      },
    },
  },
  argTypes: {
    value: { control: "radio", options: ["heads", "tails"] },
    disabled: { control: "boolean" },
    onChange: { action: "changed" },
  },
};

export default meta;
type Story = StoryObj<typeof SideSelector>;

export const Heads: Story = { args: { value: "heads", onChange: () => {} } };
export const Tails: Story = { args: { value: "tails", onChange: () => {} } };
export const Disabled: Story = { args: { value: "heads", disabled: true, onChange: () => {} } };

export const Interactive: Story = {
  render: () => {
    const [side, setSide] = useState<CoinSide>("heads");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SideSelector value={side} onChange={setSide} />
        <p style={{ color: "#aaa", fontSize: 13 }}>Selected: {side}</p>
      </div>
    );
  },
};
