import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CashOutModal } from "./CashOutModal";

const meta: Meta<typeof CashOutModal> = {
  title: "Modals/CashOutModal",
  component: CashOutModal,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Decision modal shown after a win. Compares the current cash-out payout against " +
          "the potential next-streak payout. Multipliers follow the contract spec: " +
          "1.9× (streak 1), 3.5× (streak 2), 6× (streak 3), 10× (streak 4+).",
      },
    },
  },
  argTypes: {
    streak: { control: { type: "range", min: 1, max: 5, step: 1 } },
    wager: { control: { type: "number" } },
    feeBps: { control: { type: "number" } },
    onCashOut: { action: "cashOut" },
    onContinue: { action: "continue" },
    onClose: { action: "closed" },
  },
};

export default meta;
type Story = StoryObj<typeof CashOutModal>;

export const FirstWin: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <CashOutModal {...args} open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
  args: { streak: 1, wager: 10_000_000, feeBps: 300 },
};

export const SecondWin: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <CashOutModal {...args} open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
  args: { streak: 2, wager: 10_000_000, feeBps: 300 },
};

export const MaxStreak: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <CashOutModal {...args} open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
  args: { streak: 4, wager: 10_000_000, feeBps: 300 },
};
