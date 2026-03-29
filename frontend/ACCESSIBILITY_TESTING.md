# Accessibility Testing Suite

## Overview

Automated WCAG AA accessibility testing for all Tossd frontend components using **axe-core** via `jest-axe`.

## Setup

Install dependencies:

```bash
npm install --save-dev jest-axe @testing-library/react @testing-library/jest-dom axe-core
```

Add to `jest.config.js`:

```js
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["@testing-library/jest-dom"],
};
```

## Running Tests

```bash
# All accessibility tests
npx jest --testPathPattern="a11y"

# Single component
npx jest --testPathPattern="NavBar.a11y"
```

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Accessibility tests
  run: npx jest --testPathPattern="a11y" --ci
```

## Coverage

| Component           | Tests | WCAG AA |
|---------------------|-------|---------|
| NavBar              | 5     | ✓       |
| MobileMenu          | 6     | ✓       |
| Modal               | 5     | ✓       |
| HeroSection         | 3     | ✓       |
| CTABand             | 3     | ✓       |
| SecuritySection     | 3     | ✓       |
| EconomicsPanel      | 3     | ✓       |
| FairnessTimeline    | 3     | ✓       |
| VerificationPanel   | 3     | ✓       |
| ErrorBoundary       | 2     | ✓       |

## What Is Tested

- No axe-core violations (WCAG AA ruleset)
- Interactive elements have accessible names
- Focus management (modals, menus)
- Color contrast (via design tokens)
- Keyboard navigation
- ARIA roles and attributes
