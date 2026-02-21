/**
 * MockWalletProvider — in-memory WalletProvider for tests.
 *
 * Simulates a connected wallet on a configurable network without requiring
 * the Freighter browser extension or any real key material.
 */

import type { WalletProvider } from "../../src/types/contracts";

export const TEST_PUBLIC_KEY =
  "GAI3JDDFAFQ4ORMVB62FHTWQQDJROZNNI22H6ZDT7DVQPZJXDZVXDDJF";

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export class MockWalletProvider implements WalletProvider {
  private _connected: boolean;
  private _publicKey: string;
  private _network: string;
  private _networkPassphrase: string;
  private _shouldRejectSign: boolean;
  private _signedXdrOverride: string | null;

  constructor(opts: {
    connected?: boolean;
    publicKey?: string;
    network?: string;
    networkPassphrase?: string;
    shouldRejectSign?: boolean;
    signedXdrOverride?: string;
  } = {}) {
    this._connected = opts.connected ?? true;
    this._publicKey = opts.publicKey ?? TEST_PUBLIC_KEY;
    this._network = opts.network ?? "TESTNET";
    this._networkPassphrase = opts.networkPassphrase ?? TESTNET_PASSPHRASE;
    this._shouldRejectSign = opts.shouldRejectSign ?? false;
    this._signedXdrOverride = opts.signedXdrOverride ?? null;
  }

  async isConnected(): Promise<boolean> {
    return this._connected;
  }

  async getPublicKey(): Promise<string> {
    return this._publicKey;
  }

  async getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    return {
      network: this._network,
      networkPassphrase: this._networkPassphrase,
    };
  }

  async signTransaction(
    xdr: string,
    _opts?: { network?: string; networkPassphrase?: string },
  ): Promise<string> {
    if (this._shouldRejectSign) {
      throw new Error("User declined to sign the transaction.");
    }
    // Return an override if provided, otherwise echo the input XDR
    // (sufficient for tests that don't actually submit to RPC).
    return this._signedXdrOverride ?? xdr;
  }

  // ── Test helpers ─────────────────────────────────────────────────────────────

  /** Disconnect the wallet (simulates user disconnecting). */
  disconnect(): void {
    this._connected = false;
  }

  /** Reconnect the wallet. */
  connect(): void {
    this._connected = true;
  }

  /** Make the next `signTransaction` call reject with a user-declined error. */
  rejectNextSign(): void {
    this._shouldRejectSign = true;
  }

  /** Stop rejecting signatures. */
  allowSign(): void {
    this._shouldRejectSign = false;
  }
}

/** Pre-built disconnected wallet for convenience. */
export function disconnectedWallet(): MockWalletProvider {
  return new MockWalletProvider({ connected: false });
}

/** Pre-built wallet on a different network. */
export function wrongNetworkWallet(): MockWalletProvider {
  return new MockWalletProvider({
    network: "MAINNET",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  });
}
