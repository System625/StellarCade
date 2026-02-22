/**
 * Unit tests for validation utilities.
 *
 * Tests cover normal behavior, edge cases, and failure paths.
 */

import { describe, it, expect } from "vitest";
import {
  validateWager,
  validateGameId,
  validateBadgeId,
  validateEnum,
  validateStellarAddress,
  validateContractAddress,
  validateSha256Hash,
  validateString,
  validateNumber,
  isDefined,
  isNonEmptyString,
  isPositiveBigInt,
  isNonNegativeBigInt,
  isWalletConnected,
  DEFAULT_WAGER_BOUNDS,
  ValidationErrorCode,
} from "../../../src/utils/v1/validation";

describe("validateWager", () => {
  it("accepts valid wager within default bounds", () => {
    const result = validateWager("50000000"); // 5 XLM
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(50000000n);
    }
  });

  it("accepts bigint input", () => {
    const result = validateWager(100000000n);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(100000000n);
    }
  });

  it("accepts number input", () => {
    const result = validateWager(50000000);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(50000000n);
    }
  });

  it("rejects null value", () => {
    const result = validateWager(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects undefined value", () => {
    const result = validateWager(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects empty string", () => {
    const result = validateWager("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects invalid string", () => {
    const result = validateWager("not-a-number");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidType);
    }
  });

  it("rejects zero wager", () => {
    const result = validateWager(0);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
      expect(result.error.message).toContain("greater than zero");
    }
  });

  it("rejects negative wager", () => {
    const result = validateWager(-100);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
    }
  });

  it("rejects wager below minimum", () => {
    const result = validateWager(1000000); // 0.1 XLM (below 1 XLM min)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
      expect(result.error.message).toContain("at least");
    }
  });

  it("rejects wager above maximum", () => {
    const result = validateWager("20000000000"); // 2000 XLM (above 1000 XLM max)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
      expect(result.error.message).toContain("cannot exceed");
    }
  });

  it("accepts wager at minimum bound", () => {
    const result = validateWager(DEFAULT_WAGER_BOUNDS.min);
    expect(result.success).toBe(true);
  });

  it("accepts wager at maximum bound", () => {
    const result = validateWager(DEFAULT_WAGER_BOUNDS.max);
    expect(result.success).toBe(true);
  });

  it("respects custom bounds", () => {
    const customBounds = { min: 1000n, max: 5000n };
    const result = validateWager(3000, customBounds);
    expect(result.success).toBe(true);
  });

  it("rejects wager below custom minimum", () => {
    const customBounds = { min: 1000n, max: 5000n };
    const result = validateWager(500, customBounds);
    expect(result.success).toBe(false);
  });

  it("rejects wager above custom maximum", () => {
    const customBounds = { min: 1000n, max: 5000n };
    const result = validateWager(6000, customBounds);
    expect(result.success).toBe(false);
  });
});

describe("validateGameId", () => {
  it("accepts valid game ID", () => {
    const result = validateGameId("12345");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(12345n);
    }
  });

  it("accepts bigint input", () => {
    const result = validateGameId(999n);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(999n);
    }
  });

  it("accepts zero as valid ID", () => {
    const result = validateGameId(0);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(0n);
    }
  });

  it("rejects null value", () => {
    const result = validateGameId(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects negative ID", () => {
    const result = validateGameId(-1);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
    }
  });

  it("rejects invalid string", () => {
    const result = validateGameId("abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidType);
    }
  });
});

describe("validateBadgeId", () => {
  it("accepts valid badge ID", () => {
    const result = validateBadgeId("42");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(42n);
    }
  });

  it("accepts zero as valid ID", () => {
    const result = validateBadgeId(0);
    expect(result.success).toBe(true);
  });

  it("rejects negative ID", () => {
    const result = validateBadgeId(-5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
    }
  });
});

describe("validateEnum", () => {
  const allowedSides = ["heads", "tails"] as const;

  it("accepts valid enum value", () => {
    const result = validateEnum("heads", allowedSides, "side");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("heads");
    }
  });

  it("rejects invalid enum value", () => {
    const result = validateEnum("middle" as any, allowedSides, "side");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidEnum);
      expect(result.error.message).toContain("heads, tails");
    }
  });

  it("rejects null value", () => {
    const result = validateEnum(null, allowedSides, "side");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects empty string", () => {
    const result = validateEnum("" as any, allowedSides, "side");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });
});

describe("validateStellarAddress", () => {
  // Valid base32 address - exactly 56 characters (only A-Z excluding I/O/U and 2-7)
  const validAddress = "GABCDEFGHJKLMNPQRSTUVWXYZ234567ABCDEFGHJKLMNPQRSTUVWXYZ2";

  it("accepts valid Stellar address", () => {
    const result = validateStellarAddress(validAddress);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validAddress);
    }
  });

  it("trims whitespace", () => {
    const result = validateStellarAddress(`  ${validAddress}  `);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validAddress);
    }
  });

  it("rejects null value", () => {
    const result = validateStellarAddress(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects empty string", () => {
    const result = validateStellarAddress("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects address not starting with G", () => {
    const result = validateStellarAddress("AABCDEFGHJKLMNPQRSTUVWXYZ234567ABCDEFGHJKLMNPQRSTUVWXYZ2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidAddress);
      expect(result.error.message).toContain("start with 'G'");
    }
  });

  it("rejects address with wrong length", () => {
    const result = validateStellarAddress("GABC123");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidAddress);
      expect(result.error.message).toContain("56 characters");
    }
  });

  it("rejects address with invalid characters", () => {
    // 55 valid characters + @ = 56 characters but with invalid character
    const result = validateStellarAddress("GABCDEFGHJKLMNPQRSTUVWXYZ234567ABCDEFGHJKLMNPQRSTUVWXYZ@");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidAddress);
      expect(result.error.message).toContain("invalid characters");
    }
  });

  it("rejects lowercase address", () => {
    const result = validateStellarAddress(validAddress.toLowerCase());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidAddress);
    }
  });
});

describe("validateContractAddress", () => {
  // Valid base32 contract address - exactly 56 characters (only A-Z excluding I/O/U and 2-7)
  const validContract = "CABCDEFGHJKLMNPQRSTUVWXYZ234567ABCDEFGHJKLMNPQRSTUVWXYZ2";

  it("accepts valid contract address", () => {
    const result = validateContractAddress(validContract);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validContract);
    }
  });

  it("rejects address not starting with C", () => {
    const result = validateContractAddress("GABCDEFGHJKLMNPQRSTUVWXYZ234567ABCDEFGHJKLMNPQRSTUVWXYZ2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidAddress);
      expect(result.error.message).toContain("start with 'C'");
    }
  });

  it("rejects address with wrong length", () => {
    const result = validateContractAddress("CABC123");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidAddress);
    }
  });
});

describe("validateSha256Hash", () => {
  const validHash = "a3f5c1d2e4b6789012345678901234567890abcdef1234567890abcdef123456";

  it("accepts valid SHA-256 hash", () => {
    const result = validateSha256Hash(validHash);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validHash);
    }
  });

  it("converts to lowercase", () => {
    const result = validateSha256Hash(validHash.toUpperCase());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validHash);
    }
  });

  it("trims whitespace", () => {
    const result = validateSha256Hash(`  ${validHash}  `);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validHash);
    }
  });

  it("rejects null value", () => {
    const result = validateSha256Hash(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects hash with wrong length", () => {
    const result = validateSha256Hash("abc123");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidHash);
      expect(result.error.message).toContain("64 characters");
    }
  });

  it("rejects hash with invalid characters", () => {
    const result = validateSha256Hash("g3f5c1d2e4b6789012345678901234567890abcdef1234567890abcdef123456");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidHash);
      expect(result.error.message).toContain("hexadecimal");
    }
  });
});

describe("validateString", () => {
  it("accepts valid string", () => {
    const result = validateString("hello", "name");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("hello");
    }
  });

  it("trims whitespace", () => {
    const result = validateString("  hello  ", "name");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("hello");
    }
  });

  it("rejects null value", () => {
    const result = validateString(null, "name");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects empty string by default", () => {
    const result = validateString("", "name");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("enforces minimum length", () => {
    const result = validateString("ab", "name", { minLength: 3 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.TooShort);
    }
  });

  it("enforces maximum length", () => {
    const result = validateString("abcdefghij", "name", { maxLength: 5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.TooLong);
    }
  });

  it("enforces pattern", () => {
    const result = validateString("hello!", "username", {
      pattern: /^[a-z]+$/,
      patternDescription: "lowercase letters only",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidFormat);
    }
  });

  it("accepts string matching pattern", () => {
    const result = validateString("hello", "username", {
      pattern: /^[a-z]+$/,
    });
    expect(result.success).toBe(true);
  });
});

describe("validateNumber", () => {
  it("accepts valid number", () => {
    const result = validateNumber(42, "age");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(42);
    }
  });

  it("accepts string number", () => {
    const result = validateNumber("42", "age");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(42);
    }
  });

  it("rejects null value", () => {
    const result = validateNumber(null, "age");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.Required);
    }
  });

  it("rejects invalid string", () => {
    const result = validateNumber("not-a-number", "age");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.InvalidType);
    }
  });

  it("enforces minimum bound", () => {
    const result = validateNumber(5, "age", { min: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
    }
  });

  it("enforces maximum bound", () => {
    const result = validateNumber(100, "age", { max: 50 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ValidationErrorCode.OutOfRange);
    }
  });

  it("accepts number at minimum bound", () => {
    const result = validateNumber(10, "age", { min: 10 });
    expect(result.success).toBe(true);
  });

  it("accepts number at maximum bound", () => {
    const result = validateNumber(50, "age", { max: 50 });
    expect(result.success).toBe(true);
  });
});

describe("Helper Predicates", () => {
  describe("isDefined", () => {
    it("returns true for defined values", () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined("")).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it("returns false for null or undefined", () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe("isNonEmptyString", () => {
    it("returns true for non-empty strings", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("  test  ")).toBe(true);
    });

    it("returns false for empty strings", () => {
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
    });

    it("returns false for non-strings", () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
    });
  });

  describe("isPositiveBigInt", () => {
    it("returns true for positive bigints", () => {
      expect(isPositiveBigInt(1n)).toBe(true);
      expect(isPositiveBigInt(999n)).toBe(true);
    });

    it("returns false for zero", () => {
      expect(isPositiveBigInt(0n)).toBe(false);
    });

    it("returns false for negative bigints", () => {
      expect(isPositiveBigInt(-1n)).toBe(false);
    });

    it("returns false for non-bigints", () => {
      expect(isPositiveBigInt(1)).toBe(false);
      expect(isPositiveBigInt("1")).toBe(false);
    });
  });

  describe("isNonNegativeBigInt", () => {
    it("returns true for non-negative bigints", () => {
      expect(isNonNegativeBigInt(0n)).toBe(true);
      expect(isNonNegativeBigInt(1n)).toBe(true);
      expect(isNonNegativeBigInt(999n)).toBe(true);
    });

    it("returns false for negative bigints", () => {
      expect(isNonNegativeBigInt(-1n)).toBe(false);
    });

    it("returns false for non-bigints", () => {
      expect(isNonNegativeBigInt(0)).toBe(false);
    });
  });

  describe("isWalletConnected", () => {
    it("returns true for valid wallet address", () => {
      expect(isWalletConnected("GABC...")).toBe(true);
    });

    it("returns false for null or undefined", () => {
      expect(isWalletConnected(null)).toBe(false);
      expect(isWalletConnected(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isWalletConnected("")).toBe(false);
      expect(isWalletConnected("   ")).toBe(false);
    });
  });
});

describe("Edge Cases and Stability", () => {
  it("validates same input consistently", () => {
    const input = "50000000";
    const result1 = validateWager(input);
    const result2 = validateWager(input);
    expect(result1).toEqual(result2);
  });

  it("handles very large bigint values", () => {
    const largeValue = 9007199254740991n; // Max safe integer
    const result = validateGameId(largeValue);
    expect(result.success).toBe(true);
  });

  it("preserves error context for debugging", () => {
    const result = validateWager("abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.context).toBeDefined();
      expect(result.error.context?.value).toBe("abc");
    }
  });

  it("includes field name in errors", () => {
    const result = validateEnum("invalid" as any, ["valid"], "testField");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.field).toBe("testField");
    }
  });
});
