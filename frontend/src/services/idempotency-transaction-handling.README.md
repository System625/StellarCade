# Idempotency Transaction Handling

Production-grade idempotency handling for repeat transaction requests in the StellarCade frontend. Prevents duplicate submissions, tracks request state, and handles recovery for unknown-outcome transactions.

## Overview

This module provides a complete idempotency solution for blockchain transactions, ensuring that:

- **Duplicate submissions are detected and suppressed** — prevents accidental double-spends
- **Transaction state is tracked through the full lifecycle** — PENDING → IN_FLIGHT → COMPLETED/FAILED
- **Unknown-outcome transactions can be recovered** — handles wallet closures and network timeouts
- **State persists across page reloads** — configurable storage strategy (memory/session/local)

## Architecture

### Components

1. **Types** (`types/idempotency.ts`)
   - `IdempotencyKey` — unique identifier format
   - `IdempotencyRequest` — tracked request metadata
   - `IdempotencyRequestState` — lifecycle states (PENDING, IN_FLIGHT, COMPLETED, FAILED, UNKNOWN)
   - `StorageConfig` — persistence configuration

2. **Service** (`services/idempotency-transaction-handling.ts`)
   - `IdempotencyTransactionHandler` — core business logic
   - Key generation with timestamp and random ID
   - Duplicate detection and state management
   - Storage abstraction (memory/sessionStorage/localStorage)

3. **Hook** (`hooks/useIdempotency.ts`)
   - `useIdempotency()` — React integration
   - Declarative API for components
   - Automatic error normalization
   - ContractResult<T> envelope support

## Usage

### Basic Example

```tsx
import { useIdempotency } from '@/hooks/useIdempotency';
import { useSorobanClient } from '@/hooks/useSorobanClient';

function CoinFlipGame() {
  const { submitWithIdempotency } = useIdempotency();
  const client = useSorobanClient();

  const handlePlay = async () => {
    const result = await submitWithIdempotency({
      operation: 'coinFlip',
      execute: () => client.coinFlip_play({ bet: 100n }),
      context: { gameId: 'game_123' },
    });

    if (result.success) {
      console.log('Transaction confirmed:', result.txHash);
      console.log('Game result:', result.data);
    } else {
      console.error('Transaction failed:', result.error.message);
    }
  };

  return <button onClick={handlePlay}>Play Coin Flip</button>;
}
```

### Advanced: Custom Idempotency Key

```tsx
const handlePlayWithCustomKey = async () => {
  // Generate deterministic key based on user input
  const customKey = `coinFlip_${userId}_${gameId}_${timestamp}`;

  const result = await submitWithIdempotency({
    operation: 'coinFlip',
    idempotencyKey: customKey,
    execute: () => client.coinFlip_play({ bet: 100n }),
  });
};
```

### Handling Duplicates

```tsx
const { submitWithIdempotency } = useIdempotency();

const result = await submitWithIdempotency({
  operation: 'prizePool_reserve',
  execute: () => client.pool_reserve({ gameId, amount: 1000n }),
  onDuplicate: (existingRequest) => {
    console.warn('Duplicate submission detected:', existingRequest);
    // Show user-facing warning or return cached result
  },
});
```

### Checking Request Status

```tsx
const { getStatus, submitWithIdempotency } = useIdempotency();

const result = await submitWithIdempotency({
  operation: 'coinFlip',
  execute: () => client.coinFlip_play({ bet: 100n }),
});

// Later, check status by key
const status = getStatus(result.idempotencyKey);
console.log('Current state:', status?.state);
console.log('Transaction hash:', status?.txHash);
```

### Storage Configuration

```tsx
import { StorageStrategy } from '@/types/idempotency';

// Memory only (cleared on page reload)
const { submitWithIdempotency } = useIdempotency({
  strategy: StorageStrategy.MEMORY,
});

// Session storage (cleared on tab/window close)
const { submitWithIdempotency } = useIdempotency({
  strategy: StorageStrategy.SESSION,
  ttl: 30 * 60 * 1000, // 30 minutes
});

// Local storage (persists across sessions)
const { submitWithIdempotency } = useIdempotency({
  strategy: StorageStrategy.LOCAL,
  keyPrefix: 'myapp_idempotency',
  ttl: 60 * 60 * 1000, // 1 hour
});
```

## State Transitions

Valid state transitions:

```
PENDING → IN_FLIGHT → COMPLETED
                    → FAILED
                    → UNKNOWN → COMPLETED (recovery)
                              → FAILED (recovery failed)

PENDING → FAILED (validation error)
```

Terminal states (no further transitions allowed):
- `COMPLETED` — transaction confirmed on ledger
- `FAILED` — terminal error (user rejection, validation failure, contract error)

Recoverable states:
- `UNKNOWN` — outcome unclear (wallet closed, network timeout) — can transition to COMPLETED or FAILED via recovery

## Duplicate Detection Rules

A request is considered a **duplicate** if:
1. The idempotency key matches an existing request
2. The existing request is in an **active state** (PENDING, IN_FLIGHT, or UNKNOWN)

Requests in terminal states (COMPLETED, FAILED) are **not** duplicates:
- `COMPLETED` requests return cached transaction hash and ledger
- `FAILED` requests can be retried with the same key

## Recovery Handling

When a transaction enters the `UNKNOWN` state (e.g., wallet closed during signing, network timeout):

1. The request is marked as `UNKNOWN` with the last known transaction hash (if available)
2. The service provides a recovery API: `recoverRequest({ key })`
3. Recovery requires external RPC polling (delegated to hooks/services)
4. On successful recovery, transitions to `COMPLETED` with confirmed tx hash
5. On failed recovery (tx not found), transitions to `FAILED`

**Note:** The core service provides state management for recovery, but RPC polling must be implemented by the caller (typically in a hook that integrates with `SorobanRpc.Server`).

## Error Handling

All errors are normalized to the `AppError` interface:

```ts
interface AppError {
  code: AppErrorCode;
  domain: ErrorDomain;  // RPC, API, WALLET, CONTRACT, UNKNOWN
  severity: ErrorSeverity;  // RETRYABLE, USER_ACTIONABLE, FATAL
  message: string;
  originalError?: unknown;
  context?: Record<string, unknown>;
  retryAfterMs?: number;
}
```

Errors are categorized by severity:
- **RETRYABLE** — temporary failure, caller may retry after delay (e.g., network timeout)
- **USER_ACTIONABLE** — user must take action (e.g., connect wallet, switch network)
- **FATAL** — non-recoverable, no retry will succeed (e.g., validation error, contract error)

## Cleanup and Maintenance

### Automatic Expiration

Completed and failed requests are automatically expired after the configured TTL (default: 1 hour). Active requests (PENDING, IN_FLIGHT, UNKNOWN) are **never** expired.

```tsx
const { clearExpired } = useIdempotency();

// Manually trigger cleanup (usually not needed)
clearExpired();
```

### Clear All Requests

```tsx
const { clearAll } = useIdempotency();

// Clear all requests (useful on logout)
clearAll();
```

### Clear Specific Request

```tsx
const { clearRequest } = useIdempotency();

// Mark request as FAILED and remove from active tracking
clearRequest(idempotencyKey);
```

## Integration with SorobanContractClient

The `SorobanContractClient` already tracks idempotency keys via the `seenIdempotencyKeys` Set. This module **replaces** that basic tracking with full lifecycle management and persistence.

To integrate:

```tsx
const { submitWithIdempotency } = useIdempotency();
const client = useSorobanClient();

const result = await submitWithIdempotency({
  operation: 'badge_award',
  execute: () => client.badge_award({
    badgeId: 1n,
    recipient: 'GXXX...',
  }, {
    idempotencyKey: customKey,  // Pass to client for logging
  }),
});
```

## Testing

### Unit Tests

Located in `tests/unit/idempotency-transaction-handling.test.ts`:

- Key generation and sanitization
- Duplicate detection logic
- State transition validation
- Storage persistence and expiration
- Edge cases (invalid states, missing keys, etc.)

### Integration Tests

Located in `tests/integration/idempotency-integration.test.ts`:

- End-to-end transaction flow with idempotency
- Duplicate submission blocking
- Failure handling and retry
- Context preservation
- Cleanup operations

Run tests:

```bash
cd frontend
npm test -- idempotency
```

## Design Decisions

### Why not use a global singleton?

The service can be instantiated multiple times with different configurations (e.g., different storage strategies for different features). A convenience singleton (`getIdempotencyService()`) is provided for common use cases.

### Why track state transitions explicitly?

Explicit state validation prevents invalid transitions (e.g., COMPLETED → IN_FLIGHT) that could corrupt the request lifecycle. This ensures deterministic behavior and easier debugging.

### Why not integrate RPC polling in the service?

The service is UI-agnostic and has no dependency on `@stellar/stellar-sdk`. RPC polling is context-specific (requires RPC URL, timeout config, etc.) and is better handled by hooks or higher-level services.

### Why use storage abstraction instead of direct localStorage?

- **Flexibility** — supports memory-only (testing), session (default), or local (persistence)
- **Server-side rendering** — gracefully falls back to memory when Web APIs unavailable
- **Testing** — easier to mock and reset

## Security Considerations

### Idempotency Key Format

Keys include timestamp and random ID to prevent collisions and provide temporal ordering:

```
{operation}_{timestamp}_{randomId}_{userContext?}
```

Example: `coinFlip_1708531200000_a3f5c1d2_gameId123`

### Sanitization

User-provided context is sanitized to remove special characters, preventing injection attacks if keys are logged or displayed.

### Storage Limits

Session and local storage have size limits (~5-10MB per domain). Long-term use may require periodic cleanup via `clearExpired()` or implementing a custom storage backend.

## Future Enhancements

- [ ] Add telemetry integration for tracking duplicate submission rates
- [ ] Implement automatic RPC polling for UNKNOWN state recovery
- [ ] Add retry logic with exponential backoff for retryable errors
- [ ] Support batch operations (submit multiple transactions with correlation)
- [ ] Add metrics for monitoring idempotency performance

## References

- [Issue #56](https://github.com/TheBlockCade/StellarCade/issues/56) — Original feature request
- [RFC 7231 Section 4.2.2](https://tools.ietf.org/html/rfc7231#section-4.2.2) — HTTP Idempotent Methods
- [Stripe Idempotency Guide](https://stripe.com/docs/api/idempotent_requests) — Industry best practices
