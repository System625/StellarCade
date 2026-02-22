/**
 * useAchievementBadge — React hook for AchievementBadge contract interactions.
 *
 * Wraps `SorobanContractClient` badge methods with React state management
 * (loading, error, data), leaving business logic UI-agnostic in the client.
 *
 * @example
 * ```tsx
 * const { badgesOf, badges, loading, error } = useAchievementBadge();
 *
 * useEffect(() => { badgesOf(userAddress); }, [userAddress]);
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorBanner message={error.message} />;
 * return <BadgeList ids={badges} />;
 * ```
 */

import { useState, useCallback } from "react";
import { useSorobanClient } from "./useSorobanClient";
import type { SorobanClientError } from "../types/errors";
import type { CallOptions, DefineBadgeParams } from "../types/contracts";

// ── Hook return type ───────────────────────────────────────────────────────────

export interface UseAchievementBadgeReturn {
  /** Badge IDs held by the last queried user. */
  badges: bigint[];
  loading: boolean;
  error: SorobanClientError | null;

  /**
   * Fetch the list of badge IDs awarded to `user`.
   * Populates `badges` on success.
   */
  badgesOf(user: string, opts?: CallOptions): Promise<void>;

  /**
   * Define a new badge. Admin only.
   * Returns the transaction hash on success.
   */
  defineBadge(
    admin: string,
    params: DefineBadgeParams,
    opts?: CallOptions
  ): Promise<string | undefined>;

  /**
   * Evaluate a user against a badge's criteria (admin audit action).
   * Returns the transaction hash on success.
   */
  evaluateUser(
    admin: string,
    user: string,
    badgeId: bigint,
    opts?: CallOptions
  ): Promise<string | undefined>;

  /**
   * Award a badge to a user. Admin only.
   * Returns the transaction hash on success.
   */
  awardBadge(
    admin: string,
    user: string,
    badgeId: bigint,
    opts?: CallOptions
  ): Promise<string | undefined>;

  /** Reset `error` and `badges` to their initial state. */
  reset(): void;
}

// ── Hook implementation ────────────────────────────────────────────────────────

export function useAchievementBadge(): UseAchievementBadgeReturn {
  const client = useSorobanClient();
  const [badges, setBadges] = useState<bigint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SorobanClientError | null>(null);

  const badgesOf = useCallback(
    async (user: string, opts?: CallOptions) => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.badge_badgesOf(user, opts);
        if (result.success) {
          setBadges(result.data ?? []);
        } else {
          setError(result.error);
        }
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const defineBadge = useCallback(
    async (
      admin: string,
      params: DefineBadgeParams,
      opts?: CallOptions,
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.badge_define(admin, params, opts);
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

  const evaluateUser = useCallback(
    async (
      admin: string,
      user: string,
      badgeId: bigint,
      opts?: CallOptions,
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.badge_evaluateUser(admin, user, badgeId, opts);
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

  const awardBadge = useCallback(
    async (
      admin: string,
      user: string,
      badgeId: bigint,
      opts?: CallOptions,
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.badge_award(admin, user, badgeId, opts);
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
    setBadges([]);
    setError(null);
  }, []);

  return { badges, loading, error, badgesOf, defineBadge, evaluateUser, awardBadge, reset };
}
