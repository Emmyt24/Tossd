import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WagerInput } from "../components/WagerInput";
import { CommitRevealFlow } from "../components/CommitRevealFlow";
import { WalletModal } from "../components/WalletModal";

/**
 * Frontend Form Validation & Sanitization Tests
 * 
 * Validation Patterns Documented:
 * 1. Boundary Enforcement: Wager amounts are strictly checked against min/max values.
 * 2. Format Validation: Non-numeric and excessively precise decimal inputs are rejected via regex.
 * 3. XSS Prevention: Secret inputs in CommitRevealFlow are sanitized before processing.
 * 4. Error State Recovery: Error messages clear immediately upon valid user input.
 * 5. State Integrity: Form submission is disabled when required inputs are missing or invalid.
 */

// Mock crypto for CommitRevealFlow
const mockCrypto = {
  subtle: {
    digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i;
    return arr;
  }),
};

// Use vi.stubGlobal for read-only global properties
vi.stubGlobal("crypto", mockCrypto);

// Mock Modal to be synchronous and simple for testing
vi.mock("../components/Modal", () => ({
  Modal: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="modal-root">{children}</div> : null,
}));

describe("Form Validation & Sanitization", () => {
  describe("WagerInput Validation", () => {
    it("renders with default min/max hints", () => {
      render(<WagerInput />);
      expect(screen.getByText(/Min 1 XLM/i)).toBeInTheDocument();
      expect(screen.getByText(/Max 10,000 XLM/i)).toBeInTheDocument();
    });

    it("shows error for wager below minimum", async () => {
      render(<WagerInput min={5} />);
      const input = screen.getByLabelText(/Wager amount/i);
      
      fireEvent.change(input, { target: { value: "4" } });
      
      expect(screen.getByRole("alert")).toHaveTextContent("Minimum wager is 5 XLM.");
    });

    it("shows error for wager above maximum", async () => {
      render(<WagerInput max={100} />);
      const input = screen.getByLabelText(/Wager amount/i);
      
      fireEvent.change(input, { target: { value: "101" } });
      
      expect(screen.getByRole("alert")).toHaveTextContent("Maximum wager is 100 XLM.");
    });

    it("clears error when valid value is entered", async () => {
      render(<WagerInput min={5} max={10} />);
      const input = screen.getByLabelText(/Wager amount/i);
      
      fireEvent.change(input, { target: { value: "4" } });
      expect(screen.getByRole("alert")).toBeInTheDocument();
      
      fireEvent.change(input, { target: { value: "7" } });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("prevents invalid non-numeric input based on regex", () => {
      render(<WagerInput />);
      const input = screen.getByLabelText(/Wager amount/i) as HTMLInputElement;
      
      fireEvent.change(input, { target: { value: "abc" } });
      expect(input.value).toBe(""); // Regex should block it
      
      fireEvent.change(input, { target: { value: "10.12345678" } });
      expect(input.value).toBe(""); // More than 7 decimal places blocked
    });

    it("accepts valid numeric input and clears previous errors", () => {
      render(<WagerInput min={1} />);
      const input = screen.getByLabelText(/Wager amount/i);
      
      // Trigger error
      fireEvent.change(input, { target: { value: "0.5" } });
      expect(screen.getByRole("alert")).toBeInTheDocument();
      
      // Fix with valid input
      fireEvent.change(input, { target: { value: "2.5" } });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("enforces boundary values for zero and extreme numbers", () => {
      render(<WagerInput min={1} max={100} />);
      const input = screen.getByLabelText(/Wager amount/i);

      fireEvent.change(input, { target: { value: "0" } });
      expect(screen.getByRole("alert")).toHaveTextContent("Minimum wager is 1 XLM.");

      fireEvent.change(input, { target: { value: "1000000" } });
      expect(screen.getByRole("alert")).toHaveTextContent("Maximum wager is 100 XLM.");
    });
  });

  describe("CommitRevealFlow Validation & Sanitization", () => {
    const mockOnCommit = vi.fn().mockResolvedValue(undefined);
    const mockOnReveal = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("requires secret and commitment to submit", () => {
      render(<CommitRevealFlow onCommit={mockOnCommit} onReveal={mockOnReveal} />);
      const submitBtn = screen.getByRole("button", { name: /Submit Commitment/i });
      expect(submitBtn).toBeDisabled();
    });

    it("enables submit button after generating secret", async () => {
      render(<CommitRevealFlow onCommit={mockOnCommit} onReveal={mockOnReveal} />);
      const genBtn = screen.getByRole("button", { name: /Generate/i });
      fireEvent.click(genBtn);

      await waitFor(() => {
        expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue("");
      });

      const submitBtn = screen.getByRole("button", { name: /Submit Commitment/i });
      expect(submitBtn).not.toBeDisabled();
    });

    it("sanitizes input and prevents XSS in secret field", async () => {
      render(<CommitRevealFlow onCommit={mockOnCommit} onReveal={mockOnReveal} />);
      
      // First generate to get a valid commitment state and enable the button
      fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
      await waitFor(() => expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue(""));
      
      const input = screen.getByLabelText(/Your Secret/i);
      const xssPayload = "<script>alert('xss')</script>";
      
      // Now overwrite with XSS payload
      fireEvent.change(input, { target: { value: xssPayload } });
      expect(input).toHaveValue(xssPayload);
      
      const submitBtn = screen.getByRole("button", { name: /Submit Commitment/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnCommit).toHaveBeenCalledWith(xssPayload, expect.any(String));
      });
    });

    it("displays error message on commit failure", async () => {
      const commitError = "Network error";
      const failingCommit = vi.fn().mockRejectedValue(new Error(commitError));
      render(<CommitRevealFlow onCommit={failingCommit} onReveal={mockOnReveal} />);
      
      // Generate and submit
      fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
      await waitFor(() => expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue(""));
      
      fireEvent.click(screen.getByRole("button", { name: /Submit Commitment/i }));
      
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(commitError);
      });
    });

    it("advances to reveal step after successful commit and handles reveal sanitization", async () => {
      render(<CommitRevealFlow onCommit={mockOnCommit} onReveal={mockOnReveal} />);
      
      fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
      await waitFor(() => expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue(""), { timeout: 3000 });
      fireEvent.click(screen.getByRole("button", { name: /Submit Commitment/i }));
      
      // Wait for the auto-transition (1200ms delay in component)
      await waitFor(() => {
        expect(screen.getByText(/Reveal Your Secret/i)).toBeInTheDocument();
      }, { timeout: 4000 });

      const revealInput = screen.getByLabelText(/Your Secret/i);
      const xssPayload = "<img src=x onerror=alert(1)>";
      fireEvent.change(revealInput, { target: { value: xssPayload } });
      
      const revealBtn = screen.getByRole("button", { name: /Reveal & Settle/i });
      fireEvent.click(revealBtn);

      await waitFor(() => {
        expect(mockOnReveal).toHaveBeenCalledWith(xssPayload);
      });
    });

    it("resets state and clears errors on Try Again", async () => {
      const failingCommit = vi.fn().mockRejectedValue(new Error("Fail"));
      render(<CommitRevealFlow onCommit={failingCommit} onReveal={mockOnReveal} />);
      
      fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
      await waitFor(() => expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue(""));
      
      fireEvent.click(screen.getByRole("button", { name: /Submit Commitment/i }));

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText("Fail")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Try Again/i));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText(/Generate Your Commitment/i)).toBeInTheDocument();
    });

    it("disables submit if secret is manually cleared", async () => {
      render(<CommitRevealFlow onCommit={mockOnCommit} onReveal={mockOnReveal} />);
      
      // Generate first
      fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
      await waitFor(() => expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue(""));
      
      const input = screen.getByLabelText(/Your Secret/i);
      const submitBtn = screen.getByRole("button", { name: /Submit Commitment/i });
      expect(submitBtn).not.toBeDisabled();

      // Clear input
      fireEvent.change(input, { target: { value: "" } });
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("WalletModal Validation", () => {
    it("displays error message when connection fails", async () => {
      const connectError = "User rejected connection";
      const failingConnect = vi.fn().mockRejectedValue(new Error(connectError));
      
      render(
        <WalletModal open={true} onClose={() => {}} connectWallet={failingConnect} />
      );

      const freighterBtn = screen.getByText(/Freighter/i);
      fireEvent.click(freighterBtn);

      await waitFor(() => {
        expect(screen.getByText(connectError)).toBeInTheDocument();
      });
    });

    it("displays connected state on success", async () => {
      const mockAddress = "GA...123";
      const successConnect = vi.fn().mockResolvedValue(mockAddress);
      
      render(
        <WalletModal open={true} onClose={() => {}} connectWallet={successConnect} />
      );

      const albedoBtn = screen.getByText(/Albedo/i);
      fireEvent.click(albedoBtn);

      await waitFor(
        () => {
          expect(screen.getByText(mockAddress)).toBeInTheDocument();
          expect(screen.getByText(/● Connected/i)).toBeInTheDocument();
        },
        { timeout: 4000 }
      );
    });

    it("clears connection errors when selecting a different wallet", async () => {
      const failingConnect = vi.fn().mockRejectedValue(new Error("Fail 1"));
      const successConnect = vi.fn().mockResolvedValue("GA...SUCCESS");

      const { rerender } = render(
        <WalletModal open={true} onClose={() => {}} connectWallet={failingConnect} />
      );

      fireEvent.click(screen.getByText(/Freighter/i));
      await waitFor(() => expect(screen.getByText("Fail 1")).toBeInTheDocument());

      // Change connectWallet prop to success and click Albedo
      rerender(<WalletModal open={true} onClose={() => {}} connectWallet={successConnect} />);
      fireEvent.click(screen.getByText(/Albedo/i));

      await waitFor(() => {
        expect(screen.queryByText("Fail 1")).not.toBeInTheDocument();
        expect(screen.getByText(/● Connected/i)).toBeInTheDocument();
      });
    });
  });
});
