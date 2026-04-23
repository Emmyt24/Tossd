import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WagerInput } from "../components/WagerInput";
import { CommitRevealFlow } from "../components/CommitRevealFlow";
import { WalletModal } from "../components/WalletModal";

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

// @ts-ignore
global.crypto = mockCrypto;

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
      const input = screen.getByLabelText(/Your Secret/i);
      const xssPayload = "<script>alert('xss')</script>";
      
      fireEvent.change(input, { target: { value: xssPayload } });
      
      // The value should be treated as a literal string
      expect(input).toHaveValue(xssPayload);
      
      // Generating a commitment with the payload should still work safely
      // (sha256Hex will just hash the string)
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
      vi.useFakeTimers();
      render(<CommitRevealFlow onCommit={mockOnCommit} onReveal={mockOnReveal} />);
      
      // Commit step
      fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
      await waitFor(() => expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue(""));
      fireEvent.click(screen.getByRole("button", { name: /Submit Commitment/i }));
      
      // Advance timer for step transition
      vi.advanceTimersByTime(1200);
      
      await waitFor(() => {
        expect(screen.getByText(/Reveal Your Secret/i)).toBeInTheDocument();
      });

      // Reveal step sanitization
      const revealInput = screen.getByLabelText(/Your Secret/i);
      const xssPayload = "<img src=x onerror=alert(1)>";
      fireEvent.change(revealInput, { target: { value: xssPayload } });
      
      expect(revealInput).toHaveValue(xssPayload);
      
      const revealBtn = screen.getByRole("button", { name: /Reveal & Settle/i });
      fireEvent.click(revealBtn);

      await waitFor(() => {
        expect(mockOnReveal).toHaveBeenCalledWith(xssPayload);
      });
      vi.useRealTimers();
    });

    it("resets state and clears errors on Try Again", async () => {
      const failingCommit = vi.fn().mockRejectedValue(new Error("Fail"));
      render(<CommitRevealFlow onCommit={failingCommit} onReveal={mockOnReveal} />);
      
      fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
      await waitFor(() => expect(screen.getByLabelText(/Your Secret/i)).not.toHaveValue(""));
      fireEvent.click(screen.getByRole("button", { name: /Submit Commitment/i }));

      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: /Try Again/i }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText(/Generate Your Commitment/i)).toBeInTheDocument();
    });
  });

  describe("WalletModal Validation", () => {
    it("displays error message when connection fails", async () => {
      const connectError = "User rejected connection";
      const failingConnect = vi.fn().mockRejectedValue(new Error(connectError));
      
      render(
        <WalletModal open={true} onClose={() => {}} connectWallet={failingConnect} />
      );

      const freighterBtn = screen.getByRole("button", { name: /Freighter/i });
      fireEvent.click(freighterBtn);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(connectError);
      });
    });

    it("displays connected state on success", async () => {
      const mockAddress = "GA...123";
      const successConnect = vi.fn().mockResolvedValue(mockAddress);
      
      render(
        <WalletModal open={true} onClose={() => {}} connectWallet={successConnect} />
      );

      const albedoBtn = screen.getByRole("button", { name: /Albedo/i });
      fireEvent.click(albedoBtn);

      await waitFor(() => {
        expect(screen.getByText(mockAddress)).toBeInTheDocument();
        expect(screen.getByText(/● Connected/i)).toBeInTheDocument();
      });
    });
  });
});
