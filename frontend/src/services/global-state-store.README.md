# Global State Store

## Purpose

Provide a deterministic, UI-agnostic global state store covering three slices:

- auth (durable)
- wallet (ephemeral)
- flags (durable)

## API

- `new GlobalStateStore(opts?)`
- `dispatch(action)` — deterministic actions (see types)
- `getState()` — read-only snapshot
- `subscribe(fn)` — subscribe to state changes
- Selectors: `selectAuth()`, `selectWallet()`, `selectFlag(key)`

## Persistence policy

- `auth` and `flags` are persisted to localStorage under `stc_global_state_v1`.
- `wallet` is intentionally ephemeral and not persisted to avoid replay/risk of stale wallet metadata.

## Validation & preconditions

The store validates payloads for key actions (e.g., `AUTH_SET` requires `userId` and `token`).

## Testing

Unit tests exist in `frontend/tests/global-state.test.ts` and mock `localStorage` via the test environment.
