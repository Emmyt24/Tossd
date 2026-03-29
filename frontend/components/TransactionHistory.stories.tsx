import type { Meta, StoryObj } from "@storybook/react";
import { TransactionHistory, GameRecord } from "./TransactionHistory";

const meta: Meta<typeof TransactionHistory> = {
  title: "Game/TransactionHistory",
  component: TransactionHistory,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Reverse-chronological game history list. Supports two pagination modes: " +
          "`'infinite'` (IntersectionObserver-based scroll loading) and `'paginate'` (prev/next buttons). " +
          "Pagination controls are wrapped in a `<nav>` with `aria-label`.",
      },
    },
  },
  argTypes: {
    mode: { control: "radio", options: ["infinite", "paginate"] },
  },
};

export default meta;
type Story = StoryObj<typeof TransactionHistory>;

const now = Date.now();
const makeRecord = (i: number): GameRecord => ({
  id: `game-${i}`,
  timestamp: now - i * 60_000,
  side: i % 2 === 0 ? "heads" : "tails",
  wagerStroops: 10_000_000,
  payoutStroops: i % 3 !== 0 ? 19_000_000 : null,
  outcome: i % 3 === 0 ? "loss" : "win",
  streak: i % 3 === 0 ? 0 : (i % 3),
  txHash: `0xabc${i}`,
});

const FEW = Array.from({ length: 5 }, (_, i) => makeRecord(i));
const MANY = Array.from({ length: 50 }, (_, i) => makeRecord(i));

export const Empty: Story = { args: { records: [] } };
export const FewRecords: Story = { args: { records: FEW } };
export const InfiniteScroll: Story = { args: { records: MANY, mode: "infinite" } };
export const Paginated: Story = { args: { records: MANY, mode: "paginate" } };
export const WithPending: Story = {
  args: {
    records: [
      { id: "p1", timestamp: now, side: "heads", wagerStroops: 5_000_000,
        payoutStroops: null, outcome: "pending", streak: 0 },
      ...FEW,
    ],
  },
};
