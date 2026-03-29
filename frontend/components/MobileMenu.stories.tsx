import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { MobileMenu } from "./MobileMenu";

const meta: Meta<typeof MobileMenu> = {
  title: "Layout/MobileMenu",
  component: MobileMenu,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Slide-in mobile navigation drawer. Rendered as `role='dialog' aria-modal='true'`. " +
          "Traps Tab/Shift+Tab focus within the panel, closes on Escape, and returns focus to the " +
          "trigger button on close. Backdrop click also closes the menu.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MobileMenu>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={triggerRef} onClick={() => setOpen(true)}>Open Menu</button>
        <MobileMenu open={open} onClose={() => setOpen(false)} triggerRef={triggerRef}>
          <nav style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <a href="#how-it-works">How It Works</a>
            <a href="#economics">Economics</a>
            <a href="#security">Security</a>
            <button onClick={() => setOpen(false)}>Close</button>
          </nav>
        </MobileMenu>
      </>
    );
  },
};
