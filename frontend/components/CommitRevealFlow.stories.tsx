import type { Meta, StoryObj } from "@storybook/react";
import { CommitRevealFlow } from "./CommitRevealFlow";

const meta: Meta<typeof CommitRevealFlow> = {
  title: "Game/CommitRevealFlow",
  component: CommitRevealFlow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Multi-step UI for the commit-reveal protocol. Generates a random 32-byte secret locally, " +
          "hashes it with SHA-256 via Web Crypto, submits the hash on-chain, then reveals the secret. " +
          "Step indicator uses `aria-current='step'`. Error and success states use `role='alert'` / `role='status'`.",
      },
    },
  },
  argTypes: {
    onCommit: { action: "commit" },
    onReveal: { action: "reveal" },
  },
};

export default meta;
type Story = StoryObj<typeof CommitRevealFlow>;

const noop = async () => {};
const failing = async () => { throw new Error("Transaction rejected by user."); };

export const Default: Story = {
  args: { onCommit: noop, onReveal: noop },
};

export const CommitFails: Story = {
  name: "Commit → Error",
  args: { onCommit: failing, onReveal: noop },
  parameters: {
    docs: {
      description: { story: "Generate a secret, then click Submit Commitment to see the error state." },
    },
  },
};

export const RevealFails: Story = {
  name: "Reveal → Error",
  args: {
    onCommit: noop,
    onReveal: async () => { throw new Error("Reveal failed — commitment mismatch"); },
  },
  parameters: {
    docs: {
      description: { story: "Complete the commit step, then enter any secret and click Reveal & Settle." },
    },
  },
};
