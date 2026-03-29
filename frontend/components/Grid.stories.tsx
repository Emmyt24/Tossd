import type { Meta, StoryObj } from "@storybook/react";
import { Grid, GridItem } from "./Grid";

const meta: Meta<typeof Grid> = {
  title: "Layout/Grid",
  component: Grid,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "CSS custom-property-driven 12-column grid. Responsive breakpoints are controlled via " +
          "`cols`, `colsMd`, and `colsSm` props. `GridItem` spans are set with `span`, `spanMd`, `spanSm`. " +
          "Resize the viewport to see the responsive behaviour.",
      },
    },
  },
  argTypes: {
    cols: { control: { type: "range", min: 1, max: 12 } },
    gap: { control: "select", options: ["none", "sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof Grid>;

const Box = ({ label }: { label: string }) => (
  <div style={{ background: "#1a2a2a", border: "1px solid #0f766e", borderRadius: 6,
    padding: "12px 8px", textAlign: "center", color: "#5eead4", fontSize: 13 }}>
    {label}
  </div>
);

export const TwelveColumn: Story = {
  render: () => (
    <div style={{ padding: 16 }}>
      <Grid cols={12} gap="md">
        {Array.from({ length: 12 }, (_, i) => (
          <GridItem key={i} span={1}><Box label={`${i + 1}`} /></GridItem>
        ))}
      </Grid>
    </div>
  ),
};

export const HeroLayout: Story = {
  render: () => (
    <div style={{ padding: 16 }}>
      <Grid cols={12} gap="lg">
        <GridItem span={7} spanMd={12}><Box label="Copy (7 cols)" /></GridItem>
        <GridItem span={5} spanMd={12}><Box label="Visual (5 cols)" /></GridItem>
      </Grid>
    </div>
  ),
};

export const ThreeColumn: Story = {
  render: () => (
    <div style={{ padding: 16 }}>
      <Grid cols={3} colsSm={1} gap="md">
        {["Feature A", "Feature B", "Feature C"].map((l) => (
          <GridItem key={l} span={1}><Box label={l} /></GridItem>
        ))}
      </Grid>
    </div>
  ),
};
