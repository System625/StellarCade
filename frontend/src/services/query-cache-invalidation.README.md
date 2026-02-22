# Query Cache & Invalidation (frontend)

## Purpose

Provide a production-grade, UI-agnostic query/cache layer for the StellarCade frontend.

This repo does not currently use TanStack Query / SWR, so the cache is implemented as a deterministic in-memory service (`QueryCache`) plus an invalidation rule engine (`QueryCacheInvalidator`).

## Canonical Query Keys

Keys are defined in `QueryKeys` (in `src/services/query-cache-invalidation.ts`).

Namespaces:

- balances
- games
- rewards
- profile

## Stale / Refetch Policy

Default policies are defined in `QueryPolicies`:

- balances: short stale time (critical)
- rewards: short stale time
- games: medium stale time
- profile: long stale time (low criticality)

Each cache entry stores:

- createdAt / updatedAt
- staleAt
- invalidatedAt (if invalidated)

Invalidation marks `invalidatedAt` (deterministic) and may trigger background refetch if a fetcher is registered and the policy has `refetchOnInvalidate: true`.

## Invalidation Rules

`QueryCacheInvalidator.applyRules()` invalidates keys based on tx/mutation outcomes.

Current rules (conservative defaults):

- Any tx affecting addresses invalidates `balances.account(address)`.
- coinFlip tx invalidates:
  - `games.byId(gameId)` (when provided)
  - `games.recentByAddress(address)`
- achievementBadge tx invalidates:
  - `rewards.byAddress(address)`
  - `profile.byAddress(address)`

Rules can be extended without changing consumers, as long as keys remain canonical.

## Cache Consistency Checks

Use `QueryCache.ensureDependencies(parent, deps)` to invalidate a parent resource if any dependency is missing/stale.

## Preconditions & Error Handling

- Fetch operations return `{ data } | { error }` where `error` is an `AppError` mapped via `toAppError()`.
- Preconditions are validated via `validatePreconditions()` (wallet/network/contract address) and surfaced as `QueryCacheInvalidationError`.

## Integration

React integration is via `QueryCacheProvider` + `useQueryCache()` in `src/hooks/useQueryCache.ts`.

The cache service itself remains UI-agnostic and can be used in non-React contexts.
