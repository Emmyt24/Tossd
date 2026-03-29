import type { Meta, StoryObj } from "@storybook/react";
import { StatsDashboard } from "./StatsDashboard";
import { ContractStats } from "./statsUtils";

const meta: Meta<typeof StatsDashboard> = {
  title: "Game/StatsDashboard",
  component: StatsDashboard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Polling stats dashboard that fetches contract metrics via an injected `fetchStats` function. " +
          "Shows skeleton placeholders while loading, an error badge on failure, and a last-updated timestamp. " +
          "Uses `aria-live='polite'` on the section so updates are announced non-intrusively.",
      },
    },
  },
  argTypes: {
    pollInterval: { control: { type: "number" } },
  },
};

export default meta;
type Story = StoryObj<typeof StatsDashboard>;

const mockStats: ContractStats = {
  total_games: 1_234,
  total_volume: 12_340_000_000n,
  total_fees: 370_200_000n,
  reserve_balance: 50_000_000_000n,
};

export const Default: Story = {
  args: {
    fetchStats: async () => mockStats,
    pollInterval: 0,
  },
};

export const Loading: Story = {
  args: {
    fetchStats: () => new Promise(() => {}), // never resolves
    pollInterval: 0,
  },
};

export const FetchError: Story = {
  name: "Error",
  args: {
    fetchStats: async () => { throw new Error("RPC unavailable"); },
    pollInterval: 0,
  },
};

export const LivePolling: Story = {
  args: {
    fetchStats: async () => ({
      ...mockStats,
      total_games: mockStats.total_games + Math.floor(Math.random() * 5),
    }),
    pollInterval: 3000,
  },
};
