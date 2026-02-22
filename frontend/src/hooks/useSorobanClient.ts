/**
 * useSorobanClient — React context + hook for SorobanContractClient.
 *
 * Provides a single `SorobanContractClient` instance across the component tree.
 * Wrap your app (or the subtree that needs contract access) in
 * `<SorobanClientProvider>`.
 *
 * @example
 * ```tsx
 * // main.tsx
 * <SorobanClientProvider>
 *   <App />
 * </SorobanClientProvider>
 *
 * // SomeComponent.tsx
 * const client = useSorobanClient();
 * const result = await client.pool_getState();
 * ```
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  SorobanContractClient,
  FreighterWalletAdapter,
} from "../services/soroban-contract-client";
import { ContractAddressRegistry } from "../store/contractAddressRegistry";

// ── Context ────────────────────────────────────────────────────────────────────

const SorobanClientContext = createContext<SorobanContractClient | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

interface SorobanClientProviderProps {
  children: ReactNode;
  /**
   * Override the client instance — useful for testing without a full Vite env.
   * If omitted, the provider reads from `import.meta.env` and uses Freighter.
   */
  client?: SorobanContractClient;
}

export function SorobanClientProvider({
  children,
  client: clientOverride,
}: SorobanClientProviderProps) {
  const client = useMemo(() => {
    if (clientOverride) return clientOverride;

    const e: Record<string, string | undefined> =
      typeof process !== "undefined" ? process.env : {};

    const rpcUrl =
      e["VITE_SOROBAN_RPC_URL"] ?? "https://soroban-testnet.stellar.org";
    const networkPassphrase =
      e["VITE_NETWORK_PASSPHRASE"] ??
      "Test SDF Network ; September 2015";

    const registry = ContractAddressRegistry.fromEnv();
    const wallet = new FreighterWalletAdapter();

    return new SorobanContractClient(rpcUrl, networkPassphrase, registry, wallet);
  }, [clientOverride]);

  return (
    <SorobanClientContext.Provider value={client}>
      {children}
    </SorobanClientContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Returns the `SorobanContractClient` instance from context.
 *
 * @throws {Error} if called outside of `<SorobanClientProvider>`.
 */
export function useSorobanClient(): SorobanContractClient {
  const client = useContext(SorobanClientContext);
  if (!client) {
    throw new Error(
      "useSorobanClient must be used inside <SorobanClientProvider>. " +
        "Wrap your component tree with the provider.",
    );
  }
  return client;
}
