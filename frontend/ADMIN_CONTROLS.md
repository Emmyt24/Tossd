# Tossd Admin Controls & Risk Management Views
Resolves Issue #88

> Design specification for admin-only control surfaces: fee management, wager limits, treasury, and pause control.
> All views follow the Tossd visual system defined in [`frontend/DESIGN.md`](./DESIGN.md).

---

## 1. Overview

Admin controls are high-trust, low-frequency surfaces. The primary design goal is to **prevent dangerous mistakes** through clear visual hierarchy, explicit warning states, and mandatory confirmation flows before any destructive or irreversible action executes.

### Admin Actions Covered

| Action | Risk Level | Reversible |
|---|---|---|
| Update fee percentage | Medium | Yes (affects future games only) |
| Update wager limits (min/max) | Medium | Yes |
| Adjust treasury address | High | Yes (but operationally sensitive) |
| Pause contract | High | Yes (`set_paused(false)`) |
| Unpause contract | Low | Yes |

---

## 2. Warning and Approval Pattern

Every admin action follows a consistent 4-step flow:

```
[1. Action Form] → [2. Warning Modal] → [3. Confirm Button] → [4. Success / Error Feedback]
```

### Step 1 — Action Form
- Standard labeled form with input validation
- Destructive actions use a `--color-state-danger` border accent on the form card
- High-risk actions use a `--color-state-warning` border accent
- Disabled state shown when action is not available in current contract state

### Step 2 — Warning Modal
- Full-screen overlay (`role="dialog"`, `aria-modal="true"`)
- Focus trapped inside modal while open (first focusable element receives focus on open; `Escape` closes without confirming)
- Warning icon (triangle with exclamation) in semantic color
- Explicit statement of what will change and consequences
- Two buttons: `Cancel` (secondary) and `Confirm` (danger/warning colored)

### Step 3 — Confirm Button
- Labeled with the exact action: e.g., `Confirm Pause Contract`
- Uses `--color-state-danger` background for destructive actions
- Uses `--color-state-warning` background for high-risk actions
- Requires deliberate click (no accidental keyboard trigger on open)

### Step 4 — Feedback
- Success: green inline banner (`role="status"`) with action summary
- Error: red inline banner (`role="alert"`) with error message and retry option
- Both auto-dismiss after 6 seconds or on manual close

---

## 3. Destructive and High-Risk State Indicators

### Visual Treatment

| Risk Level | Border | Icon | Background tint |
|---|---|---|---|
| Danger | `--color-state-danger` | `⚠` triangle, danger color | `color-mix(in srgb, var(--color-state-danger) 6%, white)` |
| Warning | `--color-state-warning` | `⚠` triangle, warning color | `color-mix(in srgb, var(--color-state-warning) 6%, white)` |
| Disabled | `--color-border-default` | lock icon, muted color | `--color-bg-subtle` |

### Disabled States
- Actions unavailable in the current contract state are rendered with `disabled` attribute and `aria-disabled="true"`
- A tooltip or inline note explains why the action is unavailable
- Example: "Unpause" is disabled when contract is already active

---

## 4. Individual Admin Views

### 4.1 Fee Management

**Purpose:** Update the protocol fee percentage (`fee_bps`).

**Risk level:** Medium — affects all games started after the change. In-flight games are isolated.

**Form fields:**
- Current fee (read-only, monospace display)
- New fee percentage (number input, 0–5%, validated against contract range)

**Warning message:**
> "Changing the fee will apply to all new games started after this update. Games currently in progress will settle at their original fee rate. This action is logged onchain."

**Validation:**
- Must be between 0 and 500 bps (0–5%)
- Must differ from current value

---

### 4.2 Wager Limits

**Purpose:** Update minimum and maximum wager amounts.

**Risk level:** Medium — affects game accessibility and reserve solvency exposure.

**Form fields:**
- Current min/max (read-only, monospace)
- New minimum wager (stroops)
- New maximum wager (stroops)

**Warning message:**
> "Updating wager limits changes the range of bets players can place. Increasing the maximum wager increases reserve exposure. Ensure reserve balance covers at least 10× the new maximum wager before confirming."

**Validation:**
- Min must be > 0
- Max must be > min
- If new max > current reserve / 10, show additional danger warning about reserve solvency

---

### 4.3 Treasury Address

**Purpose:** Update the treasury address that receives protocol fees.

**Risk level:** High — misdirected fees cannot be recovered from the contract.

**Form fields:**
- Current treasury address (read-only, monospace, truncated with full address on hover/focus)
- New treasury address (text input, Stellar address format)

**Warning message:**
> "Changing the treasury address will redirect all future protocol fees to the new address. This cannot be undone from within the contract. Verify the new address carefully — fees sent to an incorrect address are unrecoverable."

**Validation:**
- Must be a valid Stellar public key (G... format, 56 chars)
- Must not be the same as the admin address (contract enforces `AdminTreasuryConflict`)
- Must differ from current treasury address

---

### 4.4 Pause Contract

**Purpose:** Halt new game creation for emergency response.

**Risk level:** High — immediately blocks all new player activity.

**Behavior (per contract spec):**
- `set_paused(true)` blocks `start_game` only
- In-flight games continue to settle normally
- `set_paused(false)` re-enables new game creation

**Warning message (Pause):**
> "Pausing the contract will immediately prevent new games from starting. Players with active games can still reveal and settle. Use this only during security incidents or emergency maintenance."

**Warning message (Unpause):**
> "Unpausing the contract will allow new games to start. Confirm that the incident or maintenance window is fully resolved before proceeding."

**Disabled states:**
- Pause button disabled when contract is already paused
- Unpause button disabled when contract is already active

---

## 5. Accessibility Considerations

### Forms
- Every input has an associated `<label>` with `for`/`id` pairing
- Required fields marked with `aria-required="true"`
- Validation errors use `aria-describedby` to link error messages to inputs
- Error messages have `role="alert"` so screen readers announce them immediately

### Warning Modals
- `role="dialog"` and `aria-modal="true"` on the modal container
- `aria-labelledby` pointing to the modal heading
- `aria-describedby` pointing to the warning message body
- Focus trapped inside modal: Tab cycles through focusable elements only within the dialog
- `Escape` key closes the modal and returns focus to the trigger button
- On open, focus moves to the first focusable element (Cancel button, to prevent accidental confirm)

### Warning Banners
- Danger/error banners use `role="alert"` (live region, assertive)
- Success/status banners use `role="status"` (live region, polite)
- Warning icons are `aria-hidden="true"` — meaning is conveyed by text, not icon alone

### Keyboard Navigation
- All interactive elements reachable by Tab
- Buttons have visible focus rings using `--color-focus-ring`
- No keyboard traps outside of intentional modal focus management

### Color
- Warning/danger states never rely on color alone — always paired with icon and text label
- Contrast ratios meet WCAG AA minimum (4.5:1 for body text, 3:1 for large text and UI components)

---

## 6. Extending Admin Views for New Actions

To add a new admin action:

1. Add a new section card in `admin-controls.html` following the existing card structure
2. Assign the appropriate risk class: `admin-card--warning` or `admin-card--danger`
3. Add a confirmation modal following the `#modal-*` pattern with:
   - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
   - Cancel + Confirm buttons
   - Warning icon and descriptive consequence text
4. Wire the form submit to open the modal (not execute directly)
5. Wire the Confirm button to the actual action handler
6. Add success/error feedback using the `.feedback-banner` pattern
7. Document the new action in this file under Section 4

---

## 7. Design Review Checklist (Issue #88)

Before merging admin control UI changes:

- [ ] All form inputs have visible labels
- [ ] All inputs have `aria-required`, `aria-describedby` for errors
- [ ] All destructive actions have a confirmation modal
- [ ] Warning modals use `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`
- [ ] Focus is trapped in open modals; `Escape` closes without confirming
- [ ] Danger actions use `--color-state-danger` styling
- [ ] Warning actions use `--color-state-warning` styling
- [ ] Disabled states have `disabled` + `aria-disabled="true"` + explanatory text
- [ ] Warning banners use `role="alert"` or `role="status"` appropriately
- [ ] Warning icons are `aria-hidden="true"`
- [ ] No color-only encoding of state
- [ ] All tokens sourced from `frontend/tokens/tossd.tokens.css`

---

## 8. References

- Visual system: [`frontend/DESIGN.md`](./DESIGN.md)
- Design tokens: [`frontend/tokens/tossd.tokens.css`](./tokens/tossd.tokens.css)
- Contract admin functions: `contract/src/lib.rs` — `set_fee`, `set_wager_limits`, `set_treasury`, `set_paused`
- Issue: #88
