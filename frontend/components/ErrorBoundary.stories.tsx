import type { Meta, StoryObj } from "@storybook/react";
import { ErrorBoundary } from "./ErrorBoundary";

const meta: Meta<typeof ErrorBoundary> = {
  title: "Primitives/ErrorBoundary",
  component: ErrorBoundary,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "React class-based error boundary. Catches render errors in the subtree and shows a fallback. " +
          "Supports a custom `fallback` node or render prop, `resetKeys` for automatic recovery, " +
          "and an `onError` callback for logging. The default fallback focuses its heading on mount " +
          "and uses `role='alert'` for immediate screen-reader announcement.",
      },
    },
  },
  argTypes: {
    showDetails: { control: "boolean" },
    onError: { action: "error" },
    onReset: { action: "reset" },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Simulated render error");
  return <p style={{ color: "#aaa" }}>Component rendered successfully.</p>;
}

export const NoError: Story = {
  args: { children: <Bomb shouldThrow={false} />, showDetails: false },
};

export const WithError: Story = {
  args: { children: <Bomb shouldThrow={true} />, showDetails: true },
};

export const CustomFallback: Story = {
  args: {
    children: <Bomb shouldThrow={true} />,
    fallback: <div style={{ padding: 16, color: "salmon" }}>Custom fallback UI</div>,
  },
};

export const RenderPropFallback: Story = {
  args: {
    children: <Bomb shouldThrow={true} />,
    fallback: ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
      <div style={{ padding: 16 }}>
        <p style={{ color: "salmon" }}>Caught: {error.message}</p>
        <button onClick={resetErrorBoundary}>Reset</button>
      </div>
    ),
  },
};
