/**
 * Unit tests for idempotency transaction handling service.
 *
 * Tests cover:
 * - Idempotency key generation
 * - Duplicate detection logic
 * - Request lifecycle state transitions
 * - Storage persistence and expiration
 * - Edge cases and error handling
 */

import {
  IdempotencyTransactionHandler,
  resetIdempotencyService,
} from '../../src/services/idempotency-transaction-handling';
import {
  IdempotencyRequestState,
  StorageStrategy,
} from '../../src/types/idempotency';
import type {
  IdempotencyKeyParams,
  StorageConfig,
} from '../../src/types/idempotency';

describe('IdempotencyTransactionHandler', () => {
  let service: IdempotencyTransactionHandler;

  beforeEach(() => {
    resetIdempotencyService();
    service = new IdempotencyTransactionHandler({
      strategy: StorageStrategy.MEMORY,
      keyPrefix: 'test_idempotency',
      ttl: 60_000, // 1 minute for testing
    });
  });

  afterEach(() => {
    service.clearAll();
  });

  // ── Key Generation Tests ─────────────────────────────────────────────────

  describe('generateKey', () => {
    it('should generate a valid idempotency key with operation and timestamp', () => {
      const params: IdempotencyKeyParams = {
        operation: 'coinFlip',
        timestamp: 1708531200000,
      };

      const key = service.generateKey(params);

      expect(key).toMatch(/^coinFlip_1708531200000_[a-f0-9]{8}$/);
    });

    it('should include user context when provided', () => {
      const params: IdempotencyKeyParams = {
        operation: 'prizePool',
        userContext: 'gameId123',
        timestamp: 1708531200000,
      };

      const key = service.generateKey(params);

      expect(key).toMatch(/^prizePool_1708531200000_[a-f0-9]{8}_gameId123$/);
    });

    it('should sanitize operation name by removing special characters', () => {
      const params: IdempotencyKeyParams = {
        operation: 'coin@Flip#Test!',
        timestamp: 1708531200000,
      };

      const key = service.generateKey(params);

      expect(key).toMatch(/^coinFlipTest_1708531200000_[a-f0-9]{8}$/);
    });

    it('should use current timestamp when not provided', () => {
      const beforeTimestamp = Date.now();
      const key = service.generateKey({ operation: 'test' });
      const afterTimestamp = Date.now();

      const timestampMatch = key.match(/test_(\d+)_/);
      expect(timestampMatch).toBeTruthy();

      const extractedTimestamp = parseInt(timestampMatch![1], 10);
      expect(extractedTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(extractedTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should throw error for empty operation name', () => {
      expect(() => service.generateKey({ operation: '' })).toThrow(
        'Operation name cannot be empty',
      );
    });

    it('should throw error for operation name > 64 characters', () => {
      const longOperation = 'a'.repeat(65);
      expect(() => service.generateKey({ operation: longOperation })).toThrow(
        'Operation name must be ≤ 64 characters',
      );
    });

    it('should generate unique keys for same operation', () => {
      const key1 = service.generateKey({ operation: 'test', timestamp: 1000 });
      const key2 = service.generateKey({ operation: 'test', timestamp: 1000 });

      expect(key1).not.toBe(key2); // Random ID should differ
    });
  });

  // ── Duplicate Detection Tests ────────────────────────────────────────────

  describe('checkDuplicate', () => {
    it('should return isDuplicate: false for new key', () => {
      const key = service.generateKey({ operation: 'test' });
      const result = service.checkDuplicate(key);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingRequest).toBeUndefined();
    });

    it('should detect duplicate for PENDING request', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');

      const result = service.checkDuplicate(key);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingRequest?.state).toBe(
        IdempotencyRequestState.PENDING,
      );
      expect(result.reason).toContain('PENDING');
    });

    it('should detect duplicate for IN_FLIGHT request', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);

      const result = service.checkDuplicate(key);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingRequest?.state).toBe(
        IdempotencyRequestState.IN_FLIGHT,
      );
    });

    it('should detect duplicate for UNKNOWN request', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);
      service.updateState(key, IdempotencyRequestState.UNKNOWN);

      const result = service.checkDuplicate(key);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingRequest?.state).toBe(
        IdempotencyRequestState.UNKNOWN,
      );
    });

    it('should NOT detect duplicate for COMPLETED request', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);
      service.updateState(key, IdempotencyRequestState.COMPLETED, {
        txHash: 'abc123',
      });

      const result = service.checkDuplicate(key);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingRequest?.state).toBe(
        IdempotencyRequestState.COMPLETED,
      );
    });

    it('should NOT detect duplicate for FAILED request', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.FAILED);

      const result = service.checkDuplicate(key);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingRequest?.state).toBe(
        IdempotencyRequestState.FAILED,
      );
    });
  });

  // ── Request Lifecycle Tests ──────────────────────────────────────────────

  describe('registerRequest', () => {
    it('should create a new request in PENDING state', () => {
      const key = service.generateKey({ operation: 'coinFlip' });
      const request = service.registerRequest(key, 'coinFlip', {
        gameId: 'game123',
      });

      expect(request.key).toBe(key);
      expect(request.state).toBe(IdempotencyRequestState.PENDING);
      expect(request.operation).toBe('coinFlip');
      expect(request.context).toEqual({ gameId: 'game123' });
      expect(request.retryCount).toBe(0);
      expect(request.createdAt).toBeLessThanOrEqual(Date.now());
      expect(request.updatedAt).toBe(request.createdAt);
    });

    it('should return existing request when duplicate detected', () => {
      const key = service.generateKey({ operation: 'test' });
      const first = service.registerRequest(key, 'test');
      const second = service.registerRequest(key, 'test');

      expect(second.key).toBe(first.key);
      expect(second.createdAt).toBe(first.createdAt);
    });

    it('should allow re-registration after COMPLETED', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);
      service.updateState(key, IdempotencyRequestState.COMPLETED);

      // Should create new request
      const newRequest = service.registerRequest(key, 'test');
      expect(newRequest.state).toBe(IdempotencyRequestState.PENDING);
    });
  });

  describe('updateState', () => {
    it('should transition PENDING → IN_FLIGHT', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');

      const updated = service.updateState(
        key,
        IdempotencyRequestState.IN_FLIGHT,
      );

      expect(updated.state).toBe(IdempotencyRequestState.IN_FLIGHT);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(updated.createdAt);
    });

    it('should transition IN_FLIGHT → COMPLETED with txHash', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);

      const updated = service.updateState(
        key,
        IdempotencyRequestState.COMPLETED,
        {
          txHash: 'abc123',
          ledger: 12345,
        },
      );

      expect(updated.state).toBe(IdempotencyRequestState.COMPLETED);
      expect(updated.txHash).toBe('abc123');
      expect(updated.ledger).toBe(12345);
    });

    it('should transition IN_FLIGHT → FAILED with error', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);

      const error = {
        code: 'WALLET_USER_REJECTED' as const,
        domain: 'wallet' as const,
        severity: 'user_actionable' as const,
        message: 'User rejected',
      };

      const updated = service.updateState(
        key,
        IdempotencyRequestState.FAILED,
        { error },
      );

      expect(updated.state).toBe(IdempotencyRequestState.FAILED);
      expect(updated.error).toEqual(error);
    });

    it('should transition IN_FLIGHT → UNKNOWN on timeout', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);

      const updated = service.updateState(
        key,
        IdempotencyRequestState.UNKNOWN,
      );

      expect(updated.state).toBe(IdempotencyRequestState.UNKNOWN);
    });

    it('should transition UNKNOWN → COMPLETED on recovery', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);
      service.updateState(key, IdempotencyRequestState.UNKNOWN);

      const updated = service.updateState(
        key,
        IdempotencyRequestState.COMPLETED,
        { txHash: 'recovered123' },
      );

      expect(updated.state).toBe(IdempotencyRequestState.COMPLETED);
      expect(updated.txHash).toBe('recovered123');
    });

    it('should reject invalid state transition PENDING → COMPLETED', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');

      expect(() =>
        service.updateState(key, IdempotencyRequestState.COMPLETED),
      ).toThrow('Invalid state transition');
    });

    it('should reject invalid state transition COMPLETED → IN_FLIGHT', () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);
      service.updateState(key, IdempotencyRequestState.COMPLETED);

      expect(() =>
        service.updateState(key, IdempotencyRequestState.IN_FLIGHT),
      ).toThrow('Invalid state transition');
    });

    it('should throw error for non-existent key', () => {
      const key = 'nonexistent_key';

      expect(() =>
        service.updateState(key, IdempotencyRequestState.IN_FLIGHT),
      ).toThrow('No request found for idempotency key');
    });
  });

  describe('getRequest', () => {
    it('should return null for non-existent key', () => {
      const request = service.getRequest('nonexistent_key');
      expect(request).toBeNull();
    });

    it('should retrieve existing request', () => {
      const key = service.generateKey({ operation: 'test' });
      const registered = service.registerRequest(key, 'test');

      const retrieved = service.getRequest(key);

      expect(retrieved).toEqual(registered);
    });

    it('should return null for expired COMPLETED request', () => {
      const shortTtlService = new IdempotencyTransactionHandler({
        strategy: StorageStrategy.MEMORY,
        ttl: 10, // 10ms
      });

      const key = shortTtlService.generateKey({ operation: 'test' });
      shortTtlService.registerRequest(key, 'test');
      shortTtlService.updateState(key, IdempotencyRequestState.IN_FLIGHT);
      shortTtlService.updateState(key, IdempotencyRequestState.COMPLETED);

      // Wait for expiration
      const start = Date.now();
      while (Date.now() - start < 20) {
        // Busy wait
      }

      const retrieved = shortTtlService.getRequest(key);
      expect(retrieved).toBeNull();

      shortTtlService.clearAll();
    });

    it('should NOT expire PENDING request', () => {
      const shortTtlService = new IdempotencyTransactionHandler({
        strategy: StorageStrategy.MEMORY,
        ttl: 10,
      });

      const key = shortTtlService.generateKey({ operation: 'test' });
      shortTtlService.registerRequest(key, 'test');

      const start = Date.now();
      while (Date.now() - start < 20) {
        // Busy wait
      }

      const retrieved = shortTtlService.getRequest(key);
      expect(retrieved).not.toBeNull();

      shortTtlService.clearAll();
    });
  });

  // ── Cleanup Tests ─────────────────────────────────────────────────────────

  describe('clearExpired', () => {
    it('should remove only expired COMPLETED requests', () => {
      const shortTtlService = new IdempotencyTransactionHandler({
        strategy: StorageStrategy.MEMORY,
        ttl: 10,
      });

      const key1 = shortTtlService.generateKey({ operation: 'test1' });
      const key2 = shortTtlService.generateKey({ operation: 'test2' });

      shortTtlService.registerRequest(key1, 'test1');
      shortTtlService.updateState(key1, IdempotencyRequestState.IN_FLIGHT);
      shortTtlService.updateState(key1, IdempotencyRequestState.COMPLETED);

      shortTtlService.registerRequest(key2, 'test2');

      const start = Date.now();
      while (Date.now() - start < 20) {
        // Busy wait
      }

      shortTtlService.clearExpired();

      expect(shortTtlService.getRequest(key1)).toBeNull();
      expect(shortTtlService.getRequest(key2)).not.toBeNull();

      shortTtlService.clearAll();
    });
  });

  describe('clearAll', () => {
    it('should remove all requests', () => {
      const key1 = service.generateKey({ operation: 'test1' });
      const key2 = service.generateKey({ operation: 'test2' });

      service.registerRequest(key1, 'test1');
      service.registerRequest(key2, 'test2');

      service.clearAll();

      expect(service.getRequest(key1)).toBeNull();
      expect(service.getRequest(key2)).toBeNull();
    });
  });

  // ── Recovery Tests ────────────────────────────────────────────────────────

  describe('recoverRequest', () => {
    it('should return recovered: false for non-UNKNOWN state', async () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');

      const result = await service.recoverRequest({ key });

      expect(result.recovered).toBe(false);
      expect(result.request.state).toBe(IdempotencyRequestState.PENDING);
    });

    it('should mark as FAILED when txHash is missing', async () => {
      const key = service.generateKey({ operation: 'test' });
      service.registerRequest(key, 'test');
      service.updateState(key, IdempotencyRequestState.IN_FLIGHT);
      service.updateState(key, IdempotencyRequestState.UNKNOWN);

      const result = await service.recoverRequest({ key });

      expect(result.recovered).toBe(false);
      expect(result.request.state).toBe(IdempotencyRequestState.FAILED);
      expect(result.request.error?.message).toContain('without a transaction hash');
    });

    it('should throw error for non-existent key', async () => {
      await expect(
        service.recoverRequest({ key: 'nonexistent_key' }),
      ).rejects.toThrow('No request found for idempotency key');
    });
  });
});
