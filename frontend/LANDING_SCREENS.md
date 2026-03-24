# Tossd Landing Screens (High-Fidelity Spec)

This document defines production-ready landing page screens aligned to Tossd's existing visual system in [`frontend/DESIGN.md`](/home/uche-ofatu/Desktop/Tossd/frontend/DESIGN.md).

## 1. Objective

Design conversion-oriented landing experiences that communicate:

1. Provable fairness
2. Clear game flow
3. Premium trust
4. Immediate action (Launch / Audit)

## 2. Screen Set

- Desktop landing: 1440px canvas, max content width 1200px, 12-column grid
- Mobile landing: 390px canvas, 4-column grid

Both screens share identical narrative order and token usage.

## 3. Section Architecture

## Section A: Header + Hero

### Desktop

- Top nav: logo left, links center (`How It Works`, `Fairness`, `Economics`, `Security`), CTAs right
- Hero split (7/5 columns):
  - Left: large trust-first headline
  - Right: interactive proof card mock with wager, commit hash, outcome state
- Primary CTA: `Launch Tossd`
- Secondary CTA: `Audit Contract`
- Trust strip below hero:
  - `Provably Fair Commit-Reveal`
  - `On-Chain Soroban Settlement`
  - `2-5% Transparent Fee`

### Mobile

- Compact top bar: logo + menu + primary CTA
- Hero stacked, proof card below headline
- Trust strip becomes 3 stacked chips

### Copy

- Headline: `Trustless Coinflips. Verifiable Outcomes.`
- Body: `Tossd is an onchain coinflip game built on Soroban. Every outcome is auditable, every multiplier is explicit, and players choose when to secure profit or risk a streak.`

## Section B: Fairness (Core Trust Section)

### Layout

- Desktop: 2-column explanatory rail
  - Left: numbered commit-reveal timeline (`Commit -> Reveal -> Settle`)
  - Right: verification panel with hash fields and deterministic payout formula
- Mobile: vertical sequence (timeline above verification panel)

### Required UI elements

- Numbered steps with icon + caption
- Monospace hash block style for `commitHash`, `reveal`, `txId`
- "How to verify" checklist (3 bullets)

### Key message

`No hidden RNG. The protocol cannot silently rewrite outcomes.`

## Section C: Game Flow (Clarity Section)

### Layout

- Desktop: horizontal 4-step process cards
  1. Choose side + wager
  2. Reveal and resolve
  3. Cash out or continue
  4. End state + payout
- Mobile: same cards stacked with connector dividers

### Visual treatment

- Step index badges using accent-soft background
- Action/result states color-coded via semantic state tokens
- Final card includes split outcome examples (win/loss)

### Must include

- Multiplier progression line: `1.9x -> 3.5x -> 6x -> 10x`
- Explicit user decision moment: `Cash Out` vs `Double`

## Section D: Economics + Transparency

### Layout

- Desktop: 3 panels
  - Fee model
  - Example payout table
  - Reserve solvency check explanation
- Mobile: single-column panel stack

### Example table rows

- Wager `1 XLM`, Win @ `1.9x`, Fee `3%`, Net payout
- Wager `2 XLM`, Win @ `3.5x`, Fee `3%`, Net payout

### Key message

`Protocol fees are configurable and visible onchain.`

## Section E: Security + Testing Proof

### Layout

- Desktop: two-column block
  - Left: security bullets
  - Right: testing stats cards
- Mobile: stacked cards

### Required points

- Reserve solvency checks before accepting risk
- Access-controlled admin parameters
- 30+ property-based correctness checks

## Section F: Final CTA Band

### Layout

- Full-width high-contrast band with minimal copy and two CTAs
- Desktop: inline CTA group
- Mobile: stacked CTA group

### Copy

- Heading: `Play with Proof, Not Hype.`
- Subtext: `Launch Tossd to play, or audit the contract before your first flip.`

## 4. Visual Fidelity Rules

1. Use only tokens from:
   - [`frontend/tokens/tossd.tokens.css`](/home/uche-ofatu/Desktop/Tossd/frontend/tokens/tossd.tokens.css)
   - [`frontend/tokens/tossd.tokens.json`](/home/uche-ofatu/Desktop/Tossd/frontend/tokens/tossd.tokens.json)
2. Use serif display only for hero/section headers; all dense UI is sans + mono.
3. Keep fair-use evidence blocks visibly technical (mono + bordered surfaces).
4. Avoid generic startup hero clichés (no abstract marketing-only blobs without product context).

## 5. Motion + Interaction Direction

- Hero proof card enters with soft upward fade (`--motion-base`)
- Process steps reveal with stagger (`60-80ms` intervals)
- CTA hover: subtle elevation + contrast shift only
- Respect `prefers-reduced-motion`

## 6. Conversion Strategy (Non-Generic)

1. Lead with verifiability, not entertainment language.
2. Pair every claim with inspectable proof block.
3. Keep first CTA above fold and repeated in final band.
4. Place fairness before economics to establish trust hierarchy.

## 7. Desktop Wire Structure (Reference)

```text
[Header]
[Hero Left: Value + CTA] [Hero Right: Proof Card]
[Trust Strip]
[Fairness Timeline | Verification Panel]
[Game Flow 4 Steps]
[Economics Panels]
[Security + Testing]
[Final CTA Band]
[Footer]
```

## 8. Mobile Wire Structure (Reference)

```text
[Top Bar]
[Hero Value]
[Proof Card]
[Trust Chips]
[Fairness Timeline]
[Verification Panel]
[Game Flow Steps]
[Economics Panels]
[Security + Testing]
[Final CTA]
[Footer]
```

## 9. Handoff Acceptance Criteria

1. Desktop and mobile comps are both produced and documented.
2. Fairness and game-flow sections are explicit and visually prioritized.
3. All type/color/spacing choices map to Tossd tokens.
4. UI is readable, accessible, and conversion-oriented without generic SaaS styling.
