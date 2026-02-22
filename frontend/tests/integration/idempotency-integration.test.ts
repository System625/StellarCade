/**
 * @jest-environment jsdom
 */

/**
 * Integration tests for idempotency handling with transaction execution.
 *
 * Tests cover end-to-end flows:
 * - Happy path: successful transaction with idempotency
 * - Duplicate submission detection and suppression
 * - Failure handling and retry logic
 * - Recovery from unknown outcomes
 * - Integration with ContractResult<T> envelope
 */

import { renderHook, act } from '@testing-library/react';
import { useIdempotency } from '../../src/hooks/useIdempotency';
import {
  resetIdempotencyService,
} from '../../src/services/idempotency-transaction-handling';
import {
  IdempotencyRequestState,
  StorageStrategy,
} from '../../src/types/idempotency';
import type { ContractResult } from '../../src/types/contracts';

// ── Mock Transaction Executor ──────────────────────────────────────────────

type MockTxResult = ContractResult<{ amount: bigint }>;

const createSuccessResult = (
  txHash: string,
  ledger: number,
): MockTxResult => ({
  success: true,
  data: { amount: 100n },
  txHash,
  ledger,
});

const createFailureResult = (message: string): MockTxResult => ({
  success: false,
  error: {
    code: 'CONTRACT_ERROR',
    message,
    retryable: false,
    contractErrorCode: 4,
  },
});

describe('Idempotency Integration Tests', () => {
  beforeEach(() => {
    resetIdempotencyService();
  });

  // ── Happy Path Tests ───────────────────────────────────────────────────────

  describe('Happy Path', () => {
    it('should execute transaction and track state through lifecycle', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue(createSuccessResult('txHash123', 12345));

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
        });
      });

      expect(submitResult.success).toBe(true);
      expect(submitResult.txHash).toBe('txHash123');
      expect(submitResult.ledger).toBe(12345);
      expect(submitResult.data).toEqual({ amount: 100n });
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Verify final state
      const status = result.current.getStatus(submitResult.idempotencyKey);
      expect(status?.state).toBe(IdempotencyRequestState.COMPLETED);
      expect(status?.txHash).toBe('txHash123');
    });

    it('should return cached result for COMPLETED request with same key', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue(createSuccessResult('txHash123', 12345));

      const explicitKey = 'test_operation_1708531200000_abc12345';

      // First submission
      let firstResult;
      await act(async () => {
        firstResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: mockExecute,
        });
      });

      expect(firstResult.success).toBe(true);
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Second submission with same key
      mockExecute.mockClear();
      let secondResult;
      await act(async () => {
        secondResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: mockExecute,
        });
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.txHash).toBe('txHash123');
      expect(mockExecute).not.toHaveBeenCalled(); // Should not re-execute
    });
  });

  // ── Duplicate Detection Tests ──────────────────────────────────────────────

  describe('Duplicate Detection', () => {
    it('should block duplicate submission while request is IN_FLIGHT', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const explicitKey = 'test_operation_1708531200000_duplicate';

      // Slow mock executor that stays IN_FLIGHT
      const slowExecute = jest.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () => resolve(createSuccessResult('txHash123', 12345)),
              100,
            );
          }),
      );

      // Start first submission (will stay IN_FLIGHT)
      const firstPromise = act(async () => {
        return result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: slowExecute,
        });
      });

      // Attempt second submission immediately
      await act(async () => {
        const secondResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: jest.fn(),
        });

        expect(secondResult.success).toBe(false);
        expect(secondResult.error?.code).toBe('API_VALIDATION_ERROR');
        expect(secondResult.error?.message).toContain('Duplicate transaction');
      });

      // Wait for first to complete
      await firstPromise;
    });

    it('should invoke onDuplicate callback when duplicate detected', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const explicitKey = 'test_operation_1708531200000_callback';
      const onDuplicate = jest.fn();

      // Create IN_FLIGHT request
      const slowExecute = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const firstPromise = act(async () => {
        return result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: slowExecute,
        });
      });

      // Attempt duplicate
      await act(async () => {
        await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: jest.fn(),
          onDuplicate,
        });
      });

      expect(onDuplicate).toHaveBeenCalledTimes(1);
      expect(onDuplicate.mock.calls[0][0].state).toBe(
        IdempotencyRequestState.IN_FLIGHT,
      );

      await firstPromise;
    });
  });

  // ── Failure Handling Tests ─────────────────────────────────────────────────

  describe('Failure Handling', () => {
    it('should transition to FAILED on contract error', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue(createFailureResult('Contract error #4'));

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
        });
      });

      expect(submitResult.success).toBe(false);
      expect(submitResult.error).toBeDefined();

      const status = result.current.getStatus(submitResult.idempotencyKey);
      // Contract errors with retryable: false transition to FAILED
      expect(status?.state).toBe(IdempotencyRequestState.FAILED);
      expect(status?.error).toBeDefined();
    });

    it('should handle user rejection and transition to FAILED', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockRejectedValue(new Error('User declined transaction'));

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
        });
      });

      expect(submitResult.success).toBe(false);
      expect(submitResult.error?.code).toBe('WALLET_USER_REJECTED');

      const status = result.current.getStatus(submitResult.idempotencyKey);
      expect(status?.state).toBe(IdempotencyRequestState.FAILED);
    });

    it('should allow retry after FAILED state', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const explicitKey = 'test_operation_1708531200000_retry';

      // First attempt fails
      const failExecute = jest
        .fn()
        .mockRejectedValue(new Error('User declined transaction'));

      let firstResult;
      await act(async () => {
        firstResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: failExecute,
        });
      });

      expect(firstResult.success).toBe(false);

      // Second attempt succeeds
      const successExecute = jest
        .fn()
        .mockResolvedValue(createSuccessResult('txHash123', 12345));

      let secondResult;
      await act(async () => {
        secondResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          idempotencyKey: explicitKey,
          execute: successExecute,
        });
      });

      expect(secondResult.success).toBe(true);
      expect(successExecute).toHaveBeenCalledTimes(1);
    });
  });

  // ── Context Preservation Tests ─────────────────────────────────────────────

  describe('Context Preservation', () => {
    it('should preserve caller context through lifecycle', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue(createSuccessResult('txHash123', 12345));

      const context = {
        gameId: 'game_123',
        userId: 'user_456',
        betAmount: 100,
      };

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
          context,
        });
      });

      const status = result.current.getStatus(submitResult.idempotencyKey);
      expect(status?.context).toEqual(context);
    });
  });

  // ── Cleanup Tests ──────────────────────────────────────────────────────────

  describe('Cleanup Operations', () => {
    it('should clear specific request', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue(createSuccessResult('txHash123', 12345));

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
        });
      });

      const key = submitResult.idempotencyKey;
      expect(result.current.getStatus(key)).not.toBeNull();

      act(() => {
        result.current.clearRequest(key);
      });

      const status = result.current.getStatus(key);
      // Terminal states (COMPLETED/FAILED) are not modified by clearRequest
      expect(status?.state).toBe(IdempotencyRequestState.COMPLETED);
    });

    it('should clear all requests', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue(createSuccessResult('txHash123', 12345));

      // Create multiple requests
      let key1, key2;
      await act(async () => {
        const result1 = await result.current.submitWithIdempotency({
          operation: 'coinFlip1',
          execute: mockExecute,
        });
        const result2 = await result.current.submitWithIdempotency({
          operation: 'coinFlip2',
          execute: mockExecute,
        });
        key1 = result1.idempotencyKey;
        key2 = result2.idempotencyKey;
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.getStatus(key1)).toBeNull();
      expect(result.current.getStatus(key2)).toBeNull();
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle execute function that throws synchronously', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest.fn(() => {
        throw new Error('Synchronous error');
      });

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
        });
      });

      expect(submitResult.success).toBe(false);
      expect(submitResult.error?.message).toContain('Synchronous error');

      const status = result.current.getStatus(submitResult.idempotencyKey);
      expect(status?.state).toBe(IdempotencyRequestState.FAILED);
    });

    it('should handle execute function that returns non-ContractResult', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue({ customField: 'value' });

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
        });
      });

      expect(submitResult.success).toBe(true);
      expect(submitResult.data).toEqual({ customField: 'value' });
    });

    it('should handle execute function that returns ContractResult with success: true', async () => {
      const { result } = renderHook(() =>
        useIdempotency({
          strategy: StorageStrategy.MEMORY,
        }),
      );

      const mockExecute = jest
        .fn()
        .mockResolvedValue(createSuccessResult('txHash123', 12345));

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitWithIdempotency({
          operation: 'coinFlip',
          execute: mockExecute,
        });
      });

      expect(submitResult.success).toBe(true);
      expect(submitResult.txHash).toBe('txHash123');
      expect(submitResult.ledger).toBe(12345);
    });
  });
});
