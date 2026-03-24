# Tossd Visual System

> Foundational design system for Tossd frontend surfaces (landing, app shell, gameplay screens).
>
> Style direction: `webapp-02-japaneseswiss_light` adapted for a high-trust, onchain gaming product.

## 1. Principles

1. Trust before thrill: proof surfaces and risk math must be more visually prominent than promotional language.
2. Deterministic clarity: every state (pending, won, lost, timed out) should be obvious at a glance.
3. Calm precision: Swiss grid discipline + Japanese restraint; avoid noisy casino motifs.
4. Accessibility as credibility: low-friction navigation, high legibility, and predictable motion.

## 2. Brand Palette

### Core brand colors

| Name | Token | Hex | Purpose |
|---|---|---|---|
| Paper | `--color-bg-base` | `#F7F6F3` | App/page base background |
| Surface | `--color-bg-surface` | `#FFFFFF` | Cards, modals, elevated panels |
| Ink 900 | `--color-fg-primary` | `#171717` | Primary text and icon color |
| Ink 600 | `--color-fg-secondary` | `#4D4D4D` | Supporting text |
| Mist Line | `--color-border-default` | `#D8D5CF` | Hairlines and section dividers |
| Teal Proof | `--color-brand-accent` | `#0F766E` | Primary interactive accent |
| Teal Soft | `--color-brand-accent-soft` | `#DDF3F0` | Badges and low-emphasis highlights |

### Semantic state colors

| State | Token | Hex | Use |
|---|---|---|---|
| Success | `--color-state-success` | `#1D7A45` | Win outcomes, healthy reserve status |
| Warning | `--color-state-warning` | `#B5681D` | High-risk continuation, caution labels |
| Danger | `--color-state-danger` | `#A12A2A` | Loss states, destructive actions |
| Info | `--color-state-info` | `#1F5FAF` | Commit-reveal explanations, neutral notices |

### Rationale

- Warm neutrals create institutional trust and reduce “casino neon” perception.
- Teal accent communicates credibility and technical intent versus speculative hype.
- State colors are intentionally distinct and reserved for outcomes and protocol states.

## 3. Type System

### Font stacks

- Display: `"Ivar Display", "Canela", "Times New Roman", serif`
- Body/UI: `"Suisse Intl", "Inter", "Helvetica Neue", sans-serif`
- Data/Code: `"JetBrains Mono", "IBM Plex Mono", monospace`

### Scale tokens

| Role | Token | Value | Usage |
|---|---|---|---|
| Hero | `--font-size-hero` | `clamp(3rem, 8vw, 6.5rem)` | Landing hero statement |
| H1 | `--font-size-h1` | `clamp(2rem, 4vw, 3.5rem)` | Page headers |
| H2 | `--font-size-h2` | `clamp(1.5rem, 3vw, 2.25rem)` | Section headers |
| H3 | `--font-size-h3` | `1.25rem` | Card title |
| Body | `--font-size-body` | `1rem` | Default body copy |
| Small | `--font-size-sm` | `0.875rem` | Labels, helper text |
| Mono | `--font-size-mono` | `0.875rem` | Wagers, tx hashes, multipliers |

### Weight usage

- Display headings: 600-700
- UI body: 400-500
- Numeric highlights: 600
- Monospace data: 500

### Rationale

- Serif display adds premium editorial confidence.
- Sans body preserves speed and scanning.
- Mono for wagers/multipliers signals technical exactness.

## 4. Spacing, Radius, Elevation

### Spacing scale

`4, 8, 12, 16, 24, 32, 48, 64` px

### Radius

- Small controls: `6px`
- Default surfaces: `10px`
- Large cards/modals: `16px`
- Pills/chips: `999px`

### Shadows

- `--shadow-soft`: `0 2px 10px rgba(0,0,0,0.06)`
- `--shadow-card`: `0 8px 30px rgba(0,0,0,0.08)`

### Rationale

- Low-contrast elevation keeps hierarchy clear without visual noise.
- Tight spacing increments ensure reproducible rhythm across components.

## 5. Icon Direction

1. Use line-based icons with consistent stroke weight (1.75-2px).
2. Default icon color follows text color (`--color-fg-primary` / `--color-fg-secondary`).
3. State icons may use semantic tokens only in stateful contexts.
4. Avoid decorative icon overload; icons must communicate state or action.

Preferred families: Lucide or similarly geometric, minimal sets.

## 6. Motion Principles

### Motion tokens

- `--motion-fast`: `140ms`
- `--motion-base`: `220ms`
- `--motion-slow`: `420ms`
- `--ease-standard`: `cubic-bezier(0.2, 0.8, 0.2, 1)`

### Rules

1. Motion explains state changes (flip resolution, reveal, validation), never decorates randomly.
2. Keep transforms subtle: mostly opacity, small translate (`2-8px`), scale (`0.98-1.00`).
3. Respect `prefers-reduced-motion: reduce` and disable non-essential animation.

## 7. Reusable Design Tokens

Canonical token sources:

- JSON: [`frontend/tokens/tossd.tokens.json`](/home/uche-ofatu/Desktop/Tossd/frontend/tokens/tossd.tokens.json)
- CSS variables: [`frontend/tokens/tossd.tokens.css`](/home/uche-ofatu/Desktop/Tossd/frontend/tokens/tossd.tokens.css)

Use semantic aliases in components; do not use raw hex/px values except inside token definitions.

## 8. Implementation Examples

Reference examples:

- [`frontend/examples/brand-system-examples.md`](/home/uche-ofatu/Desktop/Tossd/frontend/examples/brand-system-examples.md)

Includes:

- Button variants (primary/secondary/danger)
- Outcome chip states (win/loss/pending)
- Wager panel using mono data styles
- Motion-safe interaction snippet

## 9. Accessibility Baseline

1. Body text minimum contrast must meet WCAG AA (`4.5:1`).
2. Interactive targets must be at least `44x44px`.
3. Keyboard focus must be visible and use accent/focus ring tokens.
4. Color alone cannot encode outcome state; pair with icon/text labels.

## 10. Contributor Checklist

Before shipping UI changes:

1. Uses tokens from `frontend/tokens/*` only.
2. Uses type roles and spacing scale defined here.
3. Provides state-specific labels for win/loss/pending/timeout.
4. Supports keyboard and reduced-motion users.
5. Includes screenshot or story/example for changed component behavior.

## 11. Landing Screen Specs

High-fidelity landing compositions are documented in [`frontend/LANDING_SCREENS.md`](/home/uche-ofatu/Desktop/Tossd/frontend/LANDING_SCREENS.md). Use this when building desktop/mobile marketing screens with fairness and game-flow sections.
