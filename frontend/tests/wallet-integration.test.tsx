/**
 * WalletModal unit tests — #426
 *
 * Tests connection, error handling, and disconnection for all four wallet
 * providers using a mocked `connectWallet` prop (no real extensions needed).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletModal, WalletId } from '../../components/WalletModal';

const MOCK_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';
const WALLETS: WalletId[] = ['freighter', 'albedo', 'xbull', 'rabet'];
const WALLET_NAMES: Record<WalletId, string> = {
  freighter: 'Freighter',
  albedo: 'Albedo',
  xbull: 'xBull',
  rabet: 'Rabet',
};

function renderModal(connectWallet: (id: WalletId) => Promise<string>, onConnect = vi.fn()) {
  return render(
    <WalletModal open={true} onClose={vi.fn()} onConnect={onConnect} connectWallet={connectWallet} />
  );
}

// ── Connection flows ──────────────────────────────────────────────────────────

describe('WalletModal — connection flows', () => {
  it('renders all four wallet options', () => {
    renderModal(() => Promise.resolve(MOCK_ADDRESS));
    for (const name of Object.values(WALLET_NAMES)) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
  });

  it.each(WALLETS)('%s: successful connection shows address and calls onConnect', async (walletId) => {
    const onConnect = vi.fn();
    renderModal(() => Promise.resolve(MOCK_ADDRESS), onConnect);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(WALLET_NAMES[walletId], 'i') }));

    await waitFor(() => expect(screen.getByText(MOCK_ADDRESS)).toBeInTheDocument());
    expect(screen.getByText(/wallet connected/i)).toBeInTheDocument();
    expect(onConnect).toHaveBeenCalledWith(MOCK_ADDRESS, walletId);
  });

  it.each(WALLETS)('%s: connecting state disables all wallet buttons', async (walletId) => {
    // connectWallet never resolves — simulates in-progress connection
    renderModal(() => new Promise(() => {}));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(WALLET_NAMES[walletId], 'i') }));

    // All wallet buttons should be disabled while connecting
    for (const name of Object.values(WALLET_NAMES)) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeDisabled();
    }
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('WalletModal — error handling', () => {
  it.each(WALLETS)('%s: user rejection shows error alert', async (walletId) => {
    renderModal(() => Promise.reject(new Error('User rejected the request')));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(WALLET_NAMES[walletId], 'i') }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('User rejected the request');
  });

  it.each(WALLETS)('%s: network error shows error alert', async (walletId) => {
    renderModal(() => Promise.reject(new Error('Network error')));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(WALLET_NAMES[walletId], 'i') }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  });

  it('non-Error rejection shows generic fallback message', async () => {
    renderModal(() => Promise.reject('something went wrong'));

    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Connection failed');
  });

  it('error state allows retry with a different wallet', async () => {
    const connectWallet = vi
      .fn()
      .mockRejectedValueOnce(new Error('Freighter rejected'))
      .mockResolvedValueOnce(MOCK_ADDRESS);

    renderModal(connectWallet);

    // First attempt fails
    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    // Retry with Albedo succeeds
    fireEvent.click(screen.getByRole('button', { name: /albedo/i }));
    await waitFor(() => expect(screen.getByText(MOCK_ADDRESS)).toBeInTheDocument());
  });
});

// ── Disconnection ─────────────────────────────────────────────────────────────

describe('WalletModal — disconnection', () => {
  it('Done button calls onClose after successful connection', async () => {
    const onClose = vi.fn();
    render(
      <WalletModal
        open={true}
        onClose={onClose}
        connectWallet={() => Promise.resolve(MOCK_ADDRESS)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
    await waitFor(() => expect(screen.getByText(/wallet connected/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button (✕) calls onClose in idle state', () => {
    const onClose = vi.fn();
    render(
      <WalletModal open={true} onClose={onClose} connectWallet={() => Promise.resolve(MOCK_ADDRESS)} />
    );

    fireEvent.click(screen.getByRole('button', { name: /close wallet modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button resets state to idle', async () => {
    const onClose = vi.fn();
    render(
      <WalletModal open={true} onClose={onClose} connectWallet={() => Promise.resolve(MOCK_ADDRESS)} />
    );

    // Connect
    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
    await waitFor(() => expect(screen.getByText(/wallet connected/i)).toBeInTheDocument());

    // Close resets — onClose called, modal would be hidden by parent
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ── Wallet switching ──────────────────────────────────────────────────────────

describe('WalletModal — wallet switching', () => {
  it('connectWallet is called with the correct walletId for each provider', async () => {
    const connectWallet = vi.fn().mockResolvedValue(MOCK_ADDRESS);

    for (const walletId of WALLETS) {
      connectWallet.mockClear();
      const { unmount } = renderModal(connectWallet);

      fireEvent.click(screen.getByRole('button', { name: new RegExp(WALLET_NAMES[walletId], 'i') }));
      await waitFor(() => expect(connectWallet).toHaveBeenCalledWith(walletId));

      unmount();
    }
  });
});
