/**
 * usePrizePool — React hook for PrizePool contract interactions.
 *
 * Wraps `SorobanContractClient` prize pool methods with React state management.
 *
 * @example
 * ```tsx
 * const { poolState, fetchPoolState, loading, error } = usePrizePool();
 *
 * useEffect(() => { fetchPoolState(); }, []);
 *
 * return <p>Available: {poolState?.available.toString()}</p>;
 * ```
 */

import { useState, useCallback } from "react";
import { useSorobanClient } from "./useSorobanClient";
import type { SorobanClientError } from "../types/errors";
import type { CallOptions, PoolState } from "../types/contracts";

// ── Hook return type ───────────────────────────────────────────────────────────

export interface UsePrizePoolReturn {
  /** Latest pool state snapshot, populated by `fetchPoolState`. */
  poolState: PoolState | null;
  loading: boolean;
  error: SorobanClientError | null;

  /** Fetch the current pool state (available + reserved). */
  fetchPoolState(opts?: CallOptions): Promise<void>;

  /**
   * Fund the pool with `amount` tokens from `from`.
   * Returns the transaction hash on success.
   */
  fund(from: string, amount: bigint, opts?: CallOptions): Promise<string | undefined>;

  /**
   * Reserve `amount` for a game. Admin only.
   * Returns the transaction hash on success.
   */
  reserve(
    admin: string,
    gameId: bigint,
    amount: bigint,
    opts?: CallOptions
  ): Promise<string | undefined>;

  /**
   * Release `amount` from a game's reservation back to available. Admin only.
   * Returns the transaction hash on success.
   */
  release(
    admin: string,
    gameId: bigint,
    amount: bigint,
    opts?: CallOptions
  ): Promise<string | undefined>;

  /**
   * Pay out `amount` from a game's reservation to `to`. Admin only.
   * Returns the transaction hash on success.
   */
  payout(
    admin: string,
    to: string,
    gameId: bigint,
    amount: bigint,
    opts?: CallOptions
  ): Promise<string | undefined>;

  /** Reset `error` and `poolState` to their initial state. */
  reset(): void;
}

// ── Hook implementation ────────────────────────────────────────────────────────

export function usePrizePool(): UsePrizePoolReturn {
  const client = useSorobanClient();
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SorobanClientError | null>(null);

  const fetchPoolState = useCallback(
    async (opts?: CallOptions) => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.pool_getState(opts);
        if (result.success) {
          setPoolState(result.data);
        } else {
          setError(result.error);
        }
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const fund = useCallback(
    async (
      from: string,
      amount: bigint,
      opts?: CallOptions,
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.pool_fund(from, amount, opts);
        if (result.success) {
          return result.txHash;
        } else {
          setError(result.error);
          return undefined;
        }
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const reserve = useCallback(
    async (
      admin: string,
      gameId: bigint,
      amount: bigint,
      opts?: CallOptions,
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.pool_reserve(admin, gameId, amount, opts);
        if (result.success) {
          return result.txHash;
        } else {
          setError(result.error);
          return undefined;
        }
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const release = useCallback(
    async (
      admin: string,
      gameId: bigint,
      amount: bigint,
      opts?: CallOptions,
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.pool_release(admin, gameId, amount, opts);
        if (result.success) {
          return result.txHash;
        } else {
          setError(result.error);
          return undefined;
        }
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const payout = useCallback(
    async (
      admin: string,
      to: string,
      gameId: bigint,
      amount: bigint,
      opts?: CallOptions,
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.pool_payout(admin, to, gameId, amount, opts);
        if (result.success) {
          return result.txHash;
        } else {
          setError(result.error);
          return undefined;
        }
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    setPoolState(null);
    setError(null);
  }, []);

  return { poolState, loading, error, fetchPoolState, fund, reserve, release, payout, reset };
}
