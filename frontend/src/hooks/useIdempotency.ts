/**
 * useIdempotency — React hook for idempotent transaction submission.
 *
 * Provides a declarative API for components to submit transactions with
 * automatic duplicate detection, state tracking, and recovery handling.
 *
 * ## Usage
 * ```tsx
 * const { submitWithIdempotency, getStatus, clearRequest } = useIdempotency();
 *
 * const handleCoinFlip = async () => {
 *   const result = await submitWithIdempotency({
 *     operation: 'coinFlip',
 *     execute: () => sorobanClient.coinFlip_play({ bet: 100n }),
 *   });
 *
 *   if (result.success) {
 *     console.log('Transaction hash:', result.txHash);
 *   } else {
 *     console.error('Error:', result.error.message);
 *   }
 * };
 * ```
 */

import { useCallback, useMemo } from 'react';
import type {
  IdempotencyKey,
  IdempotencyKeyParams,
  IdempotencyRequest,
  IdempotencyRequestState,
  StorageConfig,
} from '../types/idempotency';
import { IdempotencyRequestState as State } from '../types/idempotency';
import type { AppError } from '../types/errors';
import { ErrorDomain, ErrorSeverity } from '../types/errors';
import {
  getIdempotencyService,
  type IdempotencyTransactionHandler,
} from '../services/idempotency-transaction-handling';

// ── Hook Types ─────────────────────────────────────────────────────────────

export interface SubmitWithIdempotencyParams<T> {
  /** Operation identifier for key generation. */
  operation: string;
  /** Optional user context to include in the key. */
  userContext?: string;
  /** Optional explicit idempotency key (bypasses generation). */
  idempotencyKey?: IdempotencyKey;
  /** The transaction execution function to call. */
  execute: () => Promise<T>;
  /** Optional callback invoked when duplicate is detected. */
  onDuplicate?: (existingRequest: IdempotencyRequest) => void;
  /** Additional context for telemetry/debugging. */
  context?: Record<string, unknown>;
}

export interface SubmitResult<T> {
  /** True if the transaction completed successfully. */
  success: boolean;
  /** Transaction hash (present on success). */
  txHash?: string;
  /** Ledger sequence (present on success). */
  ledger?: number;
  /** Return value from the execute function (present on success). */
  data?: T;
  /** Error details (present on failure). */
  error?: AppError;
  /** The idempotency key used for this submission. */
  idempotencyKey: IdempotencyKey;
  /** Full request metadata. */
  request: IdempotencyRequest;
}

export interface UseIdempotencyReturn {
  /**
   * Submit a transaction with automatic idempotency handling.
   */
  submitWithIdempotency: <T>(
    params: SubmitWithIdempotencyParams<T>,
  ) => Promise<SubmitResult<T>>;

  /**
   * Get the current status of a request by key.
   */
  getStatus: (key: IdempotencyKey) => IdempotencyRequest | null;

  /**
   * Clear a specific request from storage.
   */
  clearRequest: (key: IdempotencyKey) => void;

  /**
   * Clear all expired requests from storage.
   */
  clearExpired: () => void;

  /**
   * Clear all requests from storage.
   */
  clearAll: () => void;
}

// ── Hook Implementation ────────────────────────────────────────────────────

/**
 * React hook for idempotent transaction submission.
 *
 * @param config Optional storage configuration (defaults to session storage).
 */
export function useIdempotency(config?: StorageConfig): UseIdempotencyReturn {
  const service = useMemo(() => getIdempotencyService(config), [config]);

  const submitWithIdempotency = useCallback(
    async <T,>(
      params: SubmitWithIdempotencyParams<T>,
    ): Promise<SubmitResult<T>> => {
      // Generate or use provided idempotency key
      const key =
        params.idempotencyKey ??
        service.generateKey({
          operation: params.operation,
          userContext: params.userContext,
        });

      // Check for duplicates
      const duplicateCheck = service.checkDuplicate(key);
      if (duplicateCheck.isDuplicate) {
        if (params.onDuplicate) {
          params.onDuplicate(duplicateCheck.existingRequest!);
        }

        // Return existing request as a failure result
        const existing = duplicateCheck.existingRequest!;
        return {
          success: false,
          error: createDuplicateError(duplicateCheck.reason!),
          idempotencyKey: key,
          request: existing,
        };
      }

      // Check if this is a previously completed request
      if (duplicateCheck.existingRequest?.state === State.COMPLETED) {
        const existing = duplicateCheck.existingRequest;
        return {
          success: true,
          txHash: existing.txHash,
          ledger: existing.ledger,
          idempotencyKey: key,
          request: existing,
        };
      }

      // Register new request
      const request = service.registerRequest(
        key,
        params.operation,
        params.context,
      );

      try {
        // Transition to IN_FLIGHT
        service.updateState(key, State.IN_FLIGHT);

        // Execute the transaction
        const result = await params.execute();

        // Check if result is ContractResult with success: false
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          result.success === false &&
          'error' in result
        ) {
          // Handle as error
          const contractResult = result as { success: false; error: unknown };
          throw contractResult.error;
        }

        // Extract tx metadata from result
        const { txHash, ledger } = extractTxMetadata(result);

        // Extract data from ContractResult if present
        const data = extractData(result);

        // Transition to COMPLETED
        const completedRequest = service.updateState(key, State.COMPLETED, {
          txHash,
          ledger,
        });

        return {
          success: true,
          txHash,
          ledger,
          data,
          idempotencyKey: key,
          request: completedRequest,
        };
      } catch (err) {
        // Determine if error is retryable
        const appError = normalizeError(err);
        const isRetryable = appError.severity === ErrorSeverity.RETRYABLE;

        // Transition to FAILED or UNKNOWN
        // RETRYABLE → UNKNOWN (can retry later via recovery)
        // USER_ACTIONABLE → FAILED (user must take action, not retryable)
        // FATAL → FAILED (terminal error, not retryable)
        const finalState = isRetryable ? State.UNKNOWN : State.FAILED;
        const failedRequest = service.updateState(key, finalState, {
          error: appError,
        });

        return {
          success: false,
          error: appError,
          idempotencyKey: key,
          request: failedRequest,
        };
      }
    },
    [service],
  );

  const getStatus = useCallback(
    (key: IdempotencyKey): IdempotencyRequest | null => {
      return service.getRequest(key);
    },
    [service],
  );

  const clearRequest = useCallback(
    (key: IdempotencyKey): void => {
      const request = service.getRequest(key);
      if (!request) return;

      // For terminal states (COMPLETED/FAILED), just remove from storage
      if (
        request.state === State.COMPLETED ||
        request.state === State.FAILED
      ) {
        // Storage removal happens via clearExpired or manual deletion
        // No state transition needed
        return;
      }

      // For active states, transition to FAILED
      service.updateState(key, State.FAILED, {
        error: createClearedError(),
      });
    },
    [service],
  );

  const clearExpired = useCallback(() => {
    service.clearExpired();
  }, [service]);

  const clearAll = useCallback(() => {
    service.clearAll();
  }, [service]);

  return {
    submitWithIdempotency,
    getStatus,
    clearRequest,
    clearExpired,
    clearAll,
  };
}

// ── Helper Functions ───────────────────────────────────────────────────────

function extractTxMetadata(result: unknown): {
  txHash?: string;
  ledger?: number;
} {
  // Handle ContractResult<T> envelope
  if (
    result &&
    typeof result === 'object' &&
    'success' in result &&
    result.success === true
  ) {
    const contractResult = result as {
      txHash?: string;
      ledger?: number;
    };
    return {
      txHash: contractResult.txHash,
      ledger: contractResult.ledger,
    };
  }

  // Handle plain object with txHash/ledger
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    return {
      txHash: typeof obj.txHash === 'string' ? obj.txHash : undefined,
      ledger: typeof obj.ledger === 'number' ? obj.ledger : undefined,
    };
  }

  return {};
}

function extractData(result: unknown): unknown {
  // Handle ContractResult<T> envelope — extract the inner data field
  if (
    result &&
    typeof result === 'object' &&
    'success' in result &&
    result.success === true &&
    'data' in result
  ) {
    const contractResult = result as { data: unknown };
    return contractResult.data;
  }

  // For non-ContractResult, return as-is
  return result;
}

function normalizeError(err: unknown): AppError {
  // Already an AppError
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    'domain' in err &&
    'severity' in err
  ) {
    return err as AppError;
  }

  // Extract message
  const message =
    err instanceof Error ? err.message : String(err);

  // Detect user rejection
  if (
    message.toLowerCase().includes('user declined') ||
    message.toLowerCase().includes('user rejected')
  ) {
    return {
      code: 'WALLET_USER_REJECTED',
      domain: ErrorDomain.WALLET,
      severity: ErrorSeverity.USER_ACTIONABLE,
      message: 'Transaction was rejected by the user.',
      originalError: err,
    };
  }

  // Default to UNKNOWN
  return {
    code: 'UNKNOWN',
    domain: ErrorDomain.UNKNOWN,
    severity: ErrorSeverity.FATAL,
    message: `Transaction failed: ${message.slice(0, 200)}`,
    originalError: err,
  };
}

function createDuplicateError(reason: string): AppError {
  return {
    code: 'API_VALIDATION_ERROR',
    domain: ErrorDomain.API,
    severity: ErrorSeverity.USER_ACTIONABLE,
    message: `Duplicate transaction detected: ${reason}`,
  };
}

function createClearedError(): AppError {
  return {
    code: 'API_VALIDATION_ERROR',
    domain: ErrorDomain.API,
    severity: ErrorSeverity.FATAL,
    message: 'Request was manually cleared',
  };
}
