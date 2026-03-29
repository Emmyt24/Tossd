import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal } from "./Modal";

const meta: Meta<typeof Modal> = {
  title: "Primitives/Modal",
  component: Modal,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Accessible modal dialog rendered via `createPortal`. Traps focus inside the panel, " +
          "restores focus on close, locks body scroll, and closes on Escape or overlay click. " +
          "Requires a `titleId` pointing to a visible heading inside `children`.",
      },
    },
  },
  argTypes: {
    closeOnOverlayClick: { control: "boolean" },
    onClose: { action: "closed" },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open Modal</button>
        <Modal {...args} open={open} onClose={() => setOpen(false)} titleId="demo-title">
          <div style={{ padding: 24, maxWidth: 400 }}>
            <h2 id="demo-title" style={{ marginTop: 0 }}>Modal Title</h2>
            <p>Modal content goes here. Press Escape or click outside to close.</p>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      </>
    );
  },
};

export const NoOverlayClose: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open (no overlay close)</button>
        <Modal open={open} onClose={() => setOpen(false)} titleId="demo2-title" closeOnOverlayClick={false}>
          <div style={{ padding: 24, maxWidth: 400 }}>
            <h2 id="demo2-title" style={{ marginTop: 0 }}>Sticky Modal</h2>
            <p>Clicking the backdrop won't close this. Use the button or Escape.</p>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      </>
    );
  },
};
