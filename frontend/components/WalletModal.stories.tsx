import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { WalletModal, WalletId } from "./WalletModal";

const meta: Meta<typeof WalletModal> = {
  title: "Modals/WalletModal",
  component: WalletModal,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal for connecting a Stellar wallet (Freighter, Albedo, xBull, Rabet). " +
          "Accepts an injectable `connectWallet` prop for testing without real wallet extensions. " +
          "Shows connecting spinner, error banner, and connected state.",
      },
    },
  },
  argTypes: {
    onClose: { action: "closed" },
    onConnect: { action: "connected" },
  },
};

export default meta;
type Story = StoryObj<typeof WalletModal>;

const mockConnect = async (walletId: WalletId): Promise<string> => {
  await new Promise((r) => setTimeout(r, 800));
  return "GDEMO...STELLAR_PUBLIC_KEY";
};

const failingConnect = async (_walletId: WalletId): Promise<string> => {
  await new Promise((r) => setTimeout(r, 600));
  throw new Error("Extension not installed.");
};

export const Default: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Connect Wallet</button>
        <WalletModal {...args} open={open} onClose={() => setOpen(false)} connectWallet={mockConnect} />
      </>
    );
  },
};

export const ConnectionError: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Connect (will fail)</button>
        <WalletModal open={open} onClose={() => setOpen(false)} connectWallet={failingConnect} />
      </>
    );
  },
};
