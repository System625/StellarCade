/**
 * Unit tests for ContractAddressRegistry.
 */

import { ContractAddressRegistry, type ContractAddresses } from "../../src/store/contractAddressRegistry";
import { SorobanClientError, SorobanErrorCode } from "../../src/types/errors";

// Valid 56-char Soroban contract address starting with 'C'
const VALID_CONTRACT_ADDR = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

const validAddresses: ContractAddresses = {
  prizePool: VALID_CONTRACT_ADDR,
  achievementBadge: VALID_CONTRACT_ADDR,
  accessControl: VALID_CONTRACT_ADDR,
  coinFlip: VALID_CONTRACT_ADDR,
  randomGenerator: VALID_CONTRACT_ADDR,
};

describe("ContractAddressRegistry", () => {
  // ── fromObject ──────────────────────────────────────────────────────────────

  describe("fromObject()", () => {
    it("constructs with all valid addresses", () => {
      const registry = ContractAddressRegistry.fromObject(validAddresses);
      expect(registry).toBeInstanceOf(ContractAddressRegistry);
    });

    it("throws ContractAddressNotFound when an address is missing", () => {
      const bad = { ...validAddresses, prizePool: "" };
      expect(() => ContractAddressRegistry.fromObject(bad)).toThrow(SorobanClientError);
      try {
        ContractAddressRegistry.fromObject(bad);
      } catch (err) {
        expect((err as SorobanClientError).code).toBe(SorobanErrorCode.ContractAddressNotFound);
      }
    });

    it("throws ContractAddressNotFound for placeholder 'C...' values", () => {
      const bad = { ...validAddresses, achievementBadge: "C..." };
      expect(() => ContractAddressRegistry.fromObject(bad)).toThrow(SorobanClientError);
    });

    it("throws InvalidParameter for addresses with wrong format", () => {
      const bad = { ...validAddresses, coinFlip: "GABCDEF" }; // G-prefix, not C
      expect(() => ContractAddressRegistry.fromObject(bad)).toThrow(SorobanClientError);
      try {
        ContractAddressRegistry.fromObject(bad);
      } catch (err) {
        expect((err as SorobanClientError).code).toBe(SorobanErrorCode.InvalidParameter);
      }
    });

    it("throws for addresses that are too short", () => {
      const bad = { ...validAddresses, randomGenerator: "CSHORT" };
      expect(() => ContractAddressRegistry.fromObject(bad)).toThrow(SorobanClientError);
    });
  });

  // ── getAddress ──────────────────────────────────────────────────────────────

  describe("getAddress()", () => {
    it("returns the address for a valid key", () => {
      const registry = ContractAddressRegistry.fromObject(validAddresses);
      expect(registry.getAddress("prizePool")).toBe(VALID_CONTRACT_ADDR);
      expect(registry.getAddress("achievementBadge")).toBe(VALID_CONTRACT_ADDR);
    });

    it("throws ContractAddressNotFound for a placeholder address", () => {
      // Bypass validation by constructing directly with a placeholder
      // (simulating a registry that was not validated).
      const registry = new (ContractAddressRegistry as unknown as {
        new(addrs: ContractAddresses): ContractAddressRegistry;
      })({ ...validAddresses, coinFlip: "C..." });

      expect(() => registry.getAddress("coinFlip")).toThrow(SorobanClientError);
    });
  });

  // ── validate ────────────────────────────────────────────────────────────────

  describe("validate()", () => {
    it("passes silently when all addresses are valid", () => {
      const registry = ContractAddressRegistry.fromObject(validAddresses);
      expect(() => registry.validate()).not.toThrow();
    });
  });

  // ── toObject ────────────────────────────────────────────────────────────────

  describe("toObject()", () => {
    it("returns a copy of all addresses", () => {
      const registry = ContractAddressRegistry.fromObject(validAddresses);
      const obj = registry.toObject();
      expect(obj).toEqual(validAddresses);
      // Ensure it's a copy, not a reference to the internal object.
      expect(obj).not.toBe(validAddresses);
    });
  });
});
