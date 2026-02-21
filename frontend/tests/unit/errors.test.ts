/**
 * Unit tests for SorobanClientError and SorobanErrorCode.
 */

import { SorobanClientError, SorobanErrorCode } from "../../src/types/errors";

describe("SorobanClientError", () => {
  // ── Construction ────────────────────────────────────────────────────────────

  it("creates an error with the correct code and message", () => {
    const err = new SorobanClientError({
      code: SorobanErrorCode.NetworkError,
      message: "Connection refused",
    });

    expect(err.code).toBe(SorobanErrorCode.NetworkError);
    expect(err.message).toBe("Connection refused");
    expect(err.name).toBe("SorobanClientError");
    expect(err.retryable).toBe(false); // default
    expect(err.contractErrorCode).toBeUndefined();
    expect(err.originalError).toBeUndefined();
  });

  it("stores retryable=true when specified", () => {
    const err = new SorobanClientError({
      code: SorobanErrorCode.NetworkError,
      message: "Timeout",
      retryable: true,
    });
    expect(err.retryable).toBe(true);
  });

  it("stores contractErrorCode for ContractError", () => {
    const err = new SorobanClientError({
      code: SorobanErrorCode.ContractError,
      message: "BadgeNotFound",
      contractErrorCode: 4,
    });
    expect(err.contractErrorCode).toBe(4);
  });

  it("stores the originalError", () => {
    const original = new TypeError("fetch failed");
    const err = new SorobanClientError({
      code: SorobanErrorCode.NetworkError,
      message: "Network error",
      originalError: original,
    });
    expect(err.originalError).toBe(original);
  });

  // ── instanceof ──────────────────────────────────────────────────────────────

  it("is instanceof SorobanClientError", () => {
    const err = new SorobanClientError({
      code: SorobanErrorCode.RpcError,
      message: "test",
    });
    expect(err).toBeInstanceOf(SorobanClientError);
    expect(err).toBeInstanceOf(Error);
  });

  // ── Factory methods ─────────────────────────────────────────────────────────

  describe("walletNotConnected()", () => {
    it("returns a non-retryable WalletNotConnected error", () => {
      const err = SorobanClientError.walletNotConnected();
      expect(err.code).toBe(SorobanErrorCode.WalletNotConnected);
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("No wallet");
    });
  });

  describe("networkMismatch()", () => {
    it("returns a non-retryable NetworkMismatch error with both network names", () => {
      const err = SorobanClientError.networkMismatch("TESTNET", "MAINNET");
      expect(err.code).toBe(SorobanErrorCode.NetworkMismatch);
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("TESTNET");
      expect(err.message).toContain("MAINNET");
    });
  });

  describe("invalidParam()", () => {
    it("returns a non-retryable InvalidParameter error with param name and reason", () => {
      const err = SorobanClientError.invalidParam("amount", "must be > 0");
      expect(err.code).toBe(SorobanErrorCode.InvalidParameter);
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("amount");
      expect(err.message).toContain("must be > 0");
    });
  });

  describe("addressNotFound()", () => {
    it("returns a non-retryable ContractAddressNotFound error", () => {
      const err = SorobanClientError.addressNotFound("prizePool");
      expect(err.code).toBe(SorobanErrorCode.ContractAddressNotFound);
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("prizePool");
    });
  });

  // ── Error codes ─────────────────────────────────────────────────────────────

  it("covers all defined error codes", () => {
    const codes = Object.values(SorobanErrorCode);
    expect(codes).toContain(SorobanErrorCode.NetworkError);
    expect(codes).toContain(SorobanErrorCode.RpcError);
    expect(codes).toContain(SorobanErrorCode.SimulationFailed);
    expect(codes).toContain(SorobanErrorCode.TransactionFailed);
    expect(codes).toContain(SorobanErrorCode.WalletNotConnected);
    expect(codes).toContain(SorobanErrorCode.NetworkMismatch);
    expect(codes).toContain(SorobanErrorCode.UserRejected);
    expect(codes).toContain(SorobanErrorCode.ContractError);
    expect(codes).toContain(SorobanErrorCode.InvalidParameter);
    expect(codes).toContain(SorobanErrorCode.ContractAddressNotFound);
    expect(codes).toContain(SorobanErrorCode.RetryExhausted);
  });
});
