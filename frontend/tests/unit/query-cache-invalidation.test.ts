import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  QueryCache,
  QueryCacheInvalidator,
  QueryKeys,
} from "../../src/services/query-cache-invalidation";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

describe("QueryCache", () => {
  it("sets entries with deterministic meta and reports staleness", () => {
    const cache = new QueryCache();
    const key = QueryKeys.profile.byAddress("GAAA");

    const entry1 = cache.set(key, { name: "n" }, { staleTimeMs: 1000, refetchOnInvalidate: false });
    expect(entry1.meta.createdAt).toBe(Date.now());
    expect(cache.isStale(key)).toBe(false);

    vi.setSystemTime(Date.now() + 1001);
    expect(cache.isStale(key)).toBe(true);
  });

  it("getOrFetch does not mutate cache on fetch error", async () => {
    const cache = new QueryCache();
    const key = QueryKeys.games.byId("1");
    const fetcher = vi.fn(async () => {
      throw new Error("boom");
    });

    cache.registerFetcher(key, fetcher);

    const res = await cache.getOrFetch(key);
    expect("error" in res).toBe(true);
    expect(cache.get(key)).toBe(null);
  });

  it("invalidate marks entry stale and triggers refetch when enabled", async () => {
    const cache = new QueryCache();
    const key = QueryKeys.rewards.byAddress("GAAA");

    cache.set(key, { v: 1 }, { staleTimeMs: 60_000, refetchOnInvalidate: true });

    const fetcher = vi.fn(async () => ({ v: 2 }));
    cache.registerFetcher(key, fetcher);

    cache.invalidate(key, { at: Date.now(), reason: "manual" });

    await vi.runAllTimersAsync();

    expect(fetcher).toHaveBeenCalledTimes(1);
    const updated = cache.get<{ v: number }>(key);
    expect(updated?.data.v).toBe(2);
  });
});

describe("QueryCacheInvalidator", () => {
  it("invalidates balances and dependent keys on tx_success", () => {
    const cache = new QueryCache();

    const addr = "GADDR";
    const balanceKey = QueryKeys.balances.account(addr);
    cache.set(balanceKey, { x: 1 }, { staleTimeMs: 60_000, refetchOnInvalidate: false });

    const gameKey = QueryKeys.games.recentByAddress(addr);
    cache.set(gameKey, { g: 1 }, { staleTimeMs: 60_000, refetchOnInvalidate: false });

    const invalidator = new QueryCacheInvalidator(cache);

    invalidator.applyRules({
      outcome: { ok: true, txHash: "abc" },
      event: {
        at: Date.now(),
        reason: "tx_success",
        contractTx: {
          contract: "coinFlip",
          method: "play",
          addresses: [addr],
          gameId: 7,
        },
      },
    });

    expect(cache.isStale(balanceKey)).toBe(true);
    expect(cache.isStale(gameKey)).toBe(true);
  });

  it("does not throw when no matching cached keys exist", () => {
    const cache = new QueryCache();
    const invalidator = new QueryCacheInvalidator(cache);

    expect(() =>
      invalidator.applyRules({
        outcome: { ok: true },
        event: {
          at: Date.now(),
          reason: "tx_success",
          contractTx: {
            contract: "achievementBadge",
            method: "award",
            addresses: ["GADDR"],
          },
        },
      }),
    ).not.toThrow();
  });
});
