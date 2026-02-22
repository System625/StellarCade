/**
 * Idempotency handling types for transaction request correlation.
 *
 * Provides types for generating idempotency keys, tracking request state,
 * and managing duplicate submission detection across the transaction lifecycle.
 */

import type { AppError } from './errors';

// ── Idempotency Key Types ──────────────────────────────────────────────────

/**
 * Unique identifier for correlating transaction requests.
 * Format: `{operation}_{timestamp}_{randomId}`
 *
 * @example "coinFlip_1708531200000_a3f5c1d2"
 */
export type IdempotencyKey = string;

/**
 * Parameters for generating an idempotency key.
 */
export interface IdempotencyKeyParams {
  /** Operation identifier (e.g., 'coinFlip', 'prizePool_reserve'). */
  operation: string;
  /** Optional user-provided context to include in the key. */
  userContext?: string;
  /** Optional timestamp override (defaults to Date.now()). */
  timestamp?: number;
}

// ── Request State Types ────────────────────────────────────────────────────

/**
 * Lifecycle states for an idempotent transaction request.
 */
export enum IdempotencyRequestState {
  /** Request is queued but not yet submitted to the network. */
  PENDING = 'PENDING',
  /** Request has been submitted to wallet/RPC and is awaiting confirmation. */
  IN_FLIGHT = 'IN_FLIGHT',
  /** Request completed successfully with a confirmed transaction hash. */
  COMPLETED = 'COMPLETED',
  /** Request failed with a terminal error (will not be retried). */
  FAILED = 'FAILED',
  /** Request outcome is unknown (wallet closed, network timeout, etc.). */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Stored metadata for an idempotent transaction request.
 */
export interface IdempotencyRequest {
  /** Unique idempotency key for this request. */
  key: IdempotencyKey;
  /** Current lifecycle state. */
  state: IdempotencyRequestState;
  /** Operation identifier (e.g., 'coinFlip'). */
  operation: string;
  /** Timestamp when the request was created (ms since epoch). */
  createdAt: number;
  /** Timestamp of the last state transition (ms since epoch). */
  updatedAt: number;
  /** Transaction hash — present only when state is COMPLETED. */
  txHash?: string;
  /** Ledger sequence number — present only when state is COMPLETED. */
  ledger?: number;
  /** Error details — present only when state is FAILED. */
  error?: AppError;
  /** Number of retry attempts made for this request. */
  retryCount: number;
  /** Maximum retry attempts allowed for retryable errors. */
  maxRetries: number;
  /** Caller-provided context for debugging and correlation. */
  context?: Record<string, unknown>;
}

// ── Duplicate Detection Types ──────────────────────────────────────────────

/**
 * Result of checking for duplicate submission.
 */
export interface DuplicateCheckResult {
  /** True if this key has been seen before and is still active. */
  isDuplicate: boolean;
  /** The existing request, if found. */
  existingRequest?: IdempotencyRequest;
  /** Reason for duplicate detection (for telemetry/logging). */
  reason?: string;
}

// ── Recovery Types ─────────────────────────────────────────────────────────

/**
 * Options for recovering from unknown-outcome transactions.
 */
export interface RecoveryOptions {
  /** Idempotency key of the request to recover. */
  key: IdempotencyKey;
  /** Maximum time to wait for recovery polling (ms). */
  timeoutMs?: number;
  /** Polling interval for checking transaction status (ms). */
  pollIntervalMs?: number;
}

/**
 * Result of a recovery attempt.
 */
export interface RecoveryResult {
  /** True if recovery succeeded (transaction found on ledger). */
  recovered: boolean;
  /** Updated request state after recovery attempt. */
  request: IdempotencyRequest;
  /** Transaction hash if recovered successfully. */
  txHash?: string;
  /** Ledger sequence if recovered successfully. */
  ledger?: number;
}

// ── Storage Types ──────────────────────────────────────────────────────────

/**
 * Persistence strategy for idempotency request tracking.
 */
export enum StorageStrategy {
  /** In-memory only (cleared on page reload). */
  MEMORY = 'MEMORY',
  /** Session storage (cleared when tab/window closes). */
  SESSION = 'SESSION',
  /** Local storage (persists across sessions). */
  LOCAL = 'LOCAL',
}

/**
 * Configuration for idempotency request storage.
 */
export interface StorageConfig {
  /** Storage strategy to use. */
  strategy: StorageStrategy;
  /** Key prefix for storage entries (prevents collisions). */
  keyPrefix?: string;
  /** TTL for completed/failed requests (ms). Defaults to 1 hour. */
  ttl?: number;
}

// ── Service Types ──────────────────────────────────────────────────────────

/**
 * Core idempotency service interface.
 */
export interface IdempotencyService {
  /**
   * Generate a new idempotency key.
   */
  generateKey(params: IdempotencyKeyParams): IdempotencyKey;

  /**
   * Check if a key represents a duplicate submission.
   */
  checkDuplicate(key: IdempotencyKey): DuplicateCheckResult;

  /**
   * Register a new idempotent request (transitions to PENDING).
   */
  registerRequest(
    key: IdempotencyKey,
    operation: string,
    context?: Record<string, unknown>,
  ): IdempotencyRequest;

  /**
   * Update request state (e.g., PENDING → IN_FLIGHT → COMPLETED).
   */
  updateState(
    key: IdempotencyKey,
    state: IdempotencyRequestState,
    metadata?: Partial<Pick<IdempotencyRequest, 'txHash' | 'ledger' | 'error'>>,
  ): IdempotencyRequest;

  /**
   * Retrieve an existing request by key.
   */
  getRequest(key: IdempotencyKey): IdempotencyRequest | null;

  /**
   * Attempt to recover a request with UNKNOWN outcome.
   */
  recoverRequest(options: RecoveryOptions): Promise<RecoveryResult>;

  /**
   * Clear expired requests (completed/failed beyond TTL).
   */
  clearExpired(): void;

  /**
   * Clear all requests (useful for testing or logout).
   */
  clearAll(): void;
}
