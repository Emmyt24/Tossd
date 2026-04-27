import React, { createContext, useContext, useState, ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ToastProvider } from "../components/ToastProvider";
import { ToastContext } from "../components/ToastContext";
import { WalletModal } from "../components/WalletModal";
import { GameStateCard, GameState } from "../components/GameStateCard";

// --- Mock Global Crypto for tests that might need it ---
const mockCrypto = {
  subtle: {
    digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i;
    return arr;
  }),
};
vi.stubGlobal("crypto", mockCrypto);

// --- Simple Modal Mock ---
vi.mock("../components/Modal", () => ({
  Modal: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="modal-root">{children}</div> : null,
}));

// --- Test Harness for Toast ---
function ToastTestHarness() {
  const toast = useContext(ToastContext);
  return (
    <div>
      <button onClick={() => toast?.addToast({ type: "success", message: "Win!" })}>Success</button>
      <button onClick={() => toast?.addToast({ type: "error", message: "Loss!" })}>Error</button>
      <button onClick={() => toast?.addToast({ type: "info", message: "Info" })}>Info</button>
      <button onClick={() => toast?.addToast({ type: "warning", message: "Warning" })}>Warning</button>
    </div>
  );
}

// --- Mock Wallet Context / Sync Test Component ---
const WalletStateContext = createContext<{
  connected: boolean;
  address: string;
  connect: () => void;
  disconnect: () => void;
}>({
  connected: false,
  address: "",
  connect: () => {},
  disconnect: () => {},
});

function MockWalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");

  const connect = () => {
    setConnected(true);
    setAddress("GB...1234");
  };

  const disconnect = () => {
    setConnected(false);
    setAddress("");
  };

  return (
    <WalletStateContext.Provider value={{ connected, address, connect, disconnect }}>
      {children}
    </WalletStateContext.Provider>
  );
}

function WalletConsumer() {
  const wallet = useContext(WalletStateContext);
  return (
    <div>
      <div data-testid="wallet-status">{wallet.connected ? "Connected" : "Disconnected"}</div>
      <div data-testid="wallet-address">{wallet.address}</div>
      <button onClick={wallet.connect}>Connect Wallet</button>
      <button onClick={wallet.disconnect}>Disconnect</button>
    </div>
  );
}

// --- Mock Game State Component for testing concurrent updates ---
function ConcurrentGameTest() {
  const [state, setState] = useState({ streak: 0, phase: "idle" });

  const simulateUpdate1 = () => {
    // Intentional race condition simulation, normally use functional setState
    setTimeout(() => {
      setState((prev) => ({ ...prev, streak: prev.streak + 1 }));
    }, 10);
  };

  const simulateUpdate2 = () => {
    setTimeout(() => {
      setState((prev) => ({ ...prev, phase: "won" }));
    }, 10);
  };

  return (
    <div>
      <div data-testid="game-streak">{state.streak}</div>
      <div data-testid="game-phase">{state.phase}</div>
      <button onClick={() => { simulateUpdate1(); simulateUpdate2(); }}>Trigger Concurrent</button>
    </div>
  );
}


describe("State Management & Context Propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ToastProvider State Management", () => {
    it("adds and renders different toast types", async () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Success"));
      expect(screen.getByText("Win!")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Error"));
      expect(screen.getByText("Loss!")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Info"));
      expect(screen.getByText("Info")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Warning"));
      expect(screen.getByText("Warning")).toBeInTheDocument();
    });

    it("handles multiple rapid toast additions (concurrent-like state update)", async () => {
      render(
        <ToastProvider>
          <ToastTestHarness />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Success"));
      fireEvent.click(screen.getByText("Error"));
      fireEvent.click(screen.getByText("Info"));

      // All 3 should be visible
      expect(screen.getByText("Win!")).toBeInTheDocument();
      expect(screen.getByText("Loss!")).toBeInTheDocument();
      expect(screen.getByText("Info")).toBeInTheDocument();
    });
    
    it("removes toast on dismiss", async () => {
        render(
            <ToastProvider>
                <ToastTestHarness />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText("Success"));
        expect(screen.getByText("Win!")).toBeInTheDocument();
        
        // Find close button. It's the only button inside the toast
        const closeBtn = screen.getByRole('button', { name: /dismiss notification/i });
        fireEvent.click(closeBtn);

        // It has a small timeout for animation, so we must wait
        await waitFor(() => {
            expect(screen.queryByText("Win!")).not.toBeInTheDocument();
        });
    });
  });

  describe("Wallet State Synchronization", () => {
    it("synchronizes wallet connection state across components", async () => {
      render(
        <MockWalletProvider>
          <WalletConsumer />
        </MockWalletProvider>
      );

      expect(screen.getByTestId("wallet-status")).toHaveTextContent("Disconnected");
      expect(screen.getByTestId("wallet-address")).toHaveTextContent("");

      fireEvent.click(screen.getByText("Connect Wallet"));

      await waitFor(() => {
        expect(screen.getByTestId("wallet-status")).toHaveTextContent("Connected");
        expect(screen.getByTestId("wallet-address")).toHaveTextContent("GB...1234");
      });

      fireEvent.click(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(screen.getByTestId("wallet-status")).toHaveTextContent("Disconnected");
        expect(screen.getByTestId("wallet-address")).toHaveTextContent("");
      });
    });
  });

  describe("Game State Updates & Concurrent Modifications", () => {
    const BASE_GAME: GameState = {
      phase: "idle",
      side: "heads",
      wagerStroops: 10_000_000,
      streak: 0,
    };

    it("propagates GameState phase changes correctly", () => {
      const { rerender } = render(<GameStateCard game={BASE_GAME} />);
      expect(screen.getByText(/start a game/i)).toBeInTheDocument();

      rerender(<GameStateCard game={{ ...BASE_GAME, phase: "won" }} />);
      expect(screen.getByText("You Won!")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cash out/i })).toBeInTheDocument();

      rerender(<GameStateCard game={{ ...BASE_GAME, phase: "lost" }} />);
      expect(screen.getByText("You Lost")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /cash out/i })).not.toBeInTheDocument();
    });

    it("propagates GameState streak multiplier correctly", () => {
      const { rerender } = render(<GameStateCard game={{ ...BASE_GAME, streak: 0 }} />);
      expect(screen.getByText("1.9×")).toBeInTheDocument();

      rerender(<GameStateCard game={{ ...BASE_GAME, phase: "won", streak: 1 }} />);
      expect(screen.getByText("3.5×")).toBeInTheDocument();

      rerender(<GameStateCard game={{ ...BASE_GAME, phase: "won", streak: 3 }} />);
      expect(screen.getByText("10.0×")).toBeInTheDocument();
    });

    it("handles concurrent state modifications correctly via functional setState", async () => {
      render(<ConcurrentGameTest />);
      
      expect(screen.getByTestId("game-streak")).toHaveTextContent("0");
      expect(screen.getByTestId("game-phase")).toHaveTextContent("idle");

      fireEvent.click(screen.getByText("Trigger Concurrent"));

      // Both updates should resolve correctly because functional setState is used
      await waitFor(() => {
        expect(screen.getByTestId("game-streak")).toHaveTextContent("1");
        expect(screen.getByTestId("game-phase")).toHaveTextContent("won");
      });
    });
  });
});
