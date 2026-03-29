import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "./ToastContext";

const meta: Meta<typeof ToastProvider> = {
  title: "Primitives/ToastProvider",
  component: ToastProvider,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Context provider that renders a portal-based toast region. " +
          "Toasts auto-dismiss after `duration` ms (default 5 s; pass `0` to persist). " +
          "The region uses `aria-live='polite'` so additions are announced by screen readers. " +
          "Each toast has a dismiss button with `aria-label='Dismiss notification'`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToastProvider>;

function ToastDemo() {
  const { addToast } = useToast();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {(["success", "error", "warning", "info"] as const).map((type) => (
        <button key={type} onClick={() => addToast({ type, message: `This is a ${type} toast.` })}>
          {type}
        </button>
      ))}
      <button onClick={() => addToast({ type: "info", message: "Persistent toast — click × to dismiss.", duration: 0 })}>
        persistent
      </button>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemo />
    </ToastProvider>
  ),
};
