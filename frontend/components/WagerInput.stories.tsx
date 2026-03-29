import type { Meta, StoryObj } from "@storybook/react";
import { WagerInput } from "./WagerInput";

const meta: Meta<typeof WagerInput> = {
  title: "Forms/WagerInput",
  component: WagerInput,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Controlled/uncontrolled numeric input for XLM wager amounts. " +
          "Validates min/max bounds and XLM decimal precision (7 dp). " +
          "Uses `aria-invalid` and `role='alert'` on the error message for accessible validation feedback.",
      },
    },
  },
  argTypes: {
    min: { control: { type: "number" } },
    max: { control: { type: "number" } },
    disabled: { control: "boolean" },
    onChange: { action: "changed" },
  },
};

export default meta;
type Story = StoryObj<typeof WagerInput>;

export const Default: Story = { args: {} };
export const WithValue: Story = { args: { value: "5.0" } };
export const BelowMin: Story = { args: { value: "0.1", min: 1 } };
export const AboveMax: Story = { args: { value: "99999", max: 10000 } };
export const Disabled: Story = { args: { value: "2.5", disabled: true } };
export const CustomRange: Story = { args: { min: 0.5, max: 500 } };
