import React, { useState } from "react";
import { Modal } from "./Modal";
import styles from "./WalletModal.module.css";

export type WalletId = "freighter" | "albedo" | "xbull" | "rabet";

interface WalletOption {
  id: WalletId;
  name: string;
  description: string;
}

const WALLETS: WalletOption[] = [
  { id: "freighter", name: "Freighter", description: "Browser extension by SDF" },
  { id: "albedo", name: "Albedo", description: "Web-based, no install required" },
  { id: "xbull", name: "xBull", description: "Multi-platform Stellar wallet" },
  { id: "rabet", name: "Rabet", description: "Browser extension wallet" },
];

type ConnectionState =
  | { status: "idle" }
  | { status: "connecting"; walletId: WalletId }
  | { status: "connected"; walletId: WalletId; address: string }
  | { status: "error"; walletId: WalletId; message: string };

export interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the connected public key on success. */
  onConnect?: (address: string, walletId: WalletId) => void;
  /** Inject a connector for testing; defaults to the real Freighter/Albedo adapters. */
  connectWallet?: (walletId: WalletId) => Promise<string>;
}

async function defaultConnectWallet(walletId: WalletId): Promise<string> {
  // Real integration points — each wallet exposes a browser global or SDK.
  if (walletId === "freighter") {
    const { requestAccess, getPublicKey } = await import(
      /* webpackIgnore: true */ "@stellar/freighter-api"
    );
    await requestAccess();
    return getPublicKey();
  }
  if (walletId === "albedo") {
    const albedo = (await import(/* webpackIgnore: true */ "@albedo-link/intent")).default;
    const result = await albedo.publicKey({ require_existing: false });
    return result.pubkey;
  }
  throw new Error(`${walletId} integration not yet wired up.`);
}

export function WalletModal({
  open,
  onClose,
  onConnect,
  connectWallet = defaultConnectWallet,
}: WalletModalProps) {
  const [state, setState] = useState<ConnectionState>({ status: "idle" });

  const handleClose = () => {
    setState({ status: "idle" });
    onClose();
  };

  const handleSelect = async (wallet: WalletOption) => {
    setState({ status: "connecting", walletId: wallet.id });
    try {
      const address = await connectWallet(wallet.id);
      setState({ status: "connected", walletId: wallet.id, address });
      onConnect?.(address, wallet.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed.";
      setState({ status: "error", walletId: wallet.id, message });
    }
  };

  const isConnected = state.status === "connected";
  const connectedWallet =
    isConnected ? WALLETS.find((w) => w.id === state.walletId) : null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      titleId="wallet-modal-title"
      descriptionId="wallet-modal-desc"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 id="wallet-modal-title" className={styles.title}>
            {isConnected ? "Wallet Connected" : "Connect Wallet"}
          </h2>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close wallet modal"
          >
            ✕
          </button>
        </div>

        {isConnected && state.status === "connected" ? (
          <div className={styles.connectedState}>
            <span className={styles.connectedBadge}>● Connected</span>
            <p className={styles.walletName}>{connectedWallet?.name}</p>
            <p id="wallet-modal-desc" className={styles.address}>
              {state.address}
            </p>
            <button className={styles.disconnectBtn} onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <p id="wallet-modal-desc" className={styles.description}>
              Choose a Stellar wallet to connect.
            </p>

            {state.status === "error" && (
              <div role="alert" className={styles.errorBanner}>
                <span className={styles.errorIcon}>⚠</span>
                {state.message}
              </div>
            )}

            <ul className={styles.walletList} role="list">
              {WALLETS.map((wallet) => {
                const isConnecting =
                  state.status === "connecting" && state.walletId === wallet.id;
                return (
                  <li key={wallet.id}>
                    <button
                      className={styles.walletBtn}
                      onClick={() => handleSelect(wallet)}
                      disabled={state.status === "connecting"}
                      aria-busy={isConnecting}
                    >
                      <span className={styles.walletInfo}>
                        <span className={styles.walletName}>{wallet.name}</span>
                        <span className={styles.walletDesc}>{wallet.description}</span>
                      </span>
                      {isConnecting ? (
                        <span className={styles.spinner} aria-hidden="true" />
                      ) : (
                        <span className={styles.arrow} aria-hidden="true">→</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
