/**
 * Accessibility test suite — WCAG AA compliance via axe-core (jest-axe).
 *
 * Run: npx jest --testPathPattern="a11y"
 * CI:  npx jest --testPathPattern="a11y" --ci
 *
 * References: #322
 */

import React, { useRef } from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { HeroSection } from "../components/HeroSection";
import { CTABand } from "../components/CTABand";
import { SecuritySection } from "../components/SecuritySection";
import { EconomicsPanel } from "../components/EconomicsPanel";
import { FairnessTimeline } from "../components/FairnessTimeline";
import { VerificationPanel } from "../components/VerificationPanel";
import { NavBar } from "../components/NavBar";
import { MobileMenu } from "../components/MobileMenu";
import { Modal } from "../components/Modal";
import { ErrorBoundary } from "../components/ErrorBoundary";

expect.extend(toHaveNoViolations);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ─── Static sections ────────────────────────────────────────────────────────

describe("HeroSection a11y", () => {
  it("has no axe violations", () => expectNoViolations(<HeroSection />));
  it("has a labelled landmark", () => {
    const { getByRole } = render(<HeroSection />);
    expect(getByRole("region", { name: /hero/i })).toBeInTheDocument();
  });
  it("CTA links have accessible names", () => {
    const { getAllByRole } = render(<HeroSection />);
    getAllByRole("link").forEach((l) => expect(l).toHaveAccessibleName());
  });
});

describe("CTABand a11y", () => {
  it("has no axe violations", () => expectNoViolations(<CTABand />));
  it("section has accessible name", () => {
    const { getByRole } = render(<CTABand />);
    expect(getByRole("region", { name: /play with proof/i })).toBeInTheDocument();
  });
  it("buttons/links have accessible names", () => {
    const { getAllByRole } = render(<CTABand />);
    getAllByRole("link").forEach((l) => expect(l).toHaveAccessibleName());
  });
});

describe("SecuritySection a11y", () => {
  it("has no axe violations", () => expectNoViolations(<SecuritySection />));
  it("has labelled section", () => {
    const { getByRole } = render(<SecuritySection />);
    expect(getByRole("region", { name: /security/i })).toBeInTheDocument();
  });
  it("feature list uses role=list", () => {
    const { getByRole } = render(<SecuritySection />);
    expect(getByRole("list")).toBeInTheDocument();
  });
});

describe("EconomicsPanel a11y", () => {
  it("has no axe violations", () => expectNoViolations(<EconomicsPanel />));
});

describe("FairnessTimeline a11y", () => {
  it("has no axe violations", () => expectNoViolations(<FairnessTimeline />));
});

describe("VerificationPanel a11y", () => {
  it("has no axe violations", () => expectNoViolations(<VerificationPanel />));
});

// ─── NavBar ─────────────────────────────────────────────────────────────────

describe("NavBar a11y", () => {
  it("has no axe violations", () => expectNoViolations(<NavBar />));
  it("has a banner landmark", () => {
    const { getByRole } = render(<NavBar />);
    expect(getByRole("banner")).toBeInTheDocument();
  });
  it("hamburger button has accessible name", () => {
    const { getByRole } = render(<NavBar />);
    expect(getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  });
  it("hamburger has aria-expanded=false initially", () => {
    const { getByRole } = render(<NavBar />);
    expect(getByRole("button", { name: /open navigation menu/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
  it("desktop nav has accessible name", () => {
    const { getByRole } = render(<NavBar />);
    expect(getByRole("navigation", { name: /primary navigation/i })).toBeInTheDocument();
  });
});

// ─── MobileMenu ─────────────────────────────────────────────────────────────

function MobileMenuFixture({ open }: { open: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef}>Trigger</button>
      <MobileMenu open={open} onClose={() => {}} triggerRef={triggerRef}>
        <button>Item 1</button>
        <button>Item 2</button>
      </MobileMenu>
    </>
  );
}

describe("MobileMenu a11y", () => {
  it("has no axe violations when closed", () =>
    expectNoViolations(<MobileMenuFixture open={false} />));
  it("has no axe violations when open", () =>
    expectNoViolations(<MobileMenuFixture open={true} />));
  it("dialog has aria-modal=true when open", () => {
    const { getByRole } = render(<MobileMenuFixture open={true} />);
    expect(getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
  it("dialog has accessible label", () => {
    const { getByRole } = render(<MobileMenuFixture open={true} />);
    expect(getByRole("dialog", { name: /navigation menu/i })).toBeInTheDocument();
  });
  it("not rendered when closed", () => {
    const { queryByRole } = render(<MobileMenuFixture open={false} />);
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("mobile nav has accessible name", () => {
    const { getByRole } = render(<MobileMenuFixture open={true} />);
    expect(getByRole("navigation", { name: /mobile navigation/i })).toBeInTheDocument();
  });
});

// ─── Modal ──────────────────────────────────────────────────────────────────

function ModalFixture({ open }: { open: boolean }) {
  return (
    <Modal open={open} onClose={() => {}} titleId="modal-title">
      <h2 id="modal-title">Test Modal</h2>
      <button>Action</button>
    </Modal>
  );
}

describe("Modal a11y", () => {
  it("has no axe violations when open", () =>
    expectNoViolations(<ModalFixture open={true} />));
  it("has no axe violations when closed", () =>
    expectNoViolations(<ModalFixture open={false} />));
  it("dialog has aria-modal=true", () => {
    const { getByRole } = render(<ModalFixture open={true} />);
    expect(getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
  it("dialog is labelled by titleId", () => {
    const { getByRole } = render(<ModalFixture open={true} />);
    expect(getByRole("dialog")).toHaveAttribute("aria-labelledby", "modal-title");
  });
  it("not rendered when closed", () => {
    const { queryByRole } = render(<ModalFixture open={false} />);
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ─── ErrorBoundary ──────────────────────────────────────────────────────────

describe("ErrorBoundary a11y", () => {
  it("has no axe violations in normal state", () =>
    expectNoViolations(
      <ErrorBoundary>
        <p>Content</p>
      </ErrorBoundary>
    ));
  it("renders children without violations", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <p>Content</p>
      </ErrorBoundary>
    );
    expect(getByText("Content")).toBeInTheDocument();
  });
});
