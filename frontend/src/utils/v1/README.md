# Validation Utilities (v1)

Reusable input validators and guards for Stellarcade frontend.

## Overview

The validation module provides type-safe, UI-agnostic validation utilities for common input types used throughout the application. All validators return typed `ValidationResult<T>` with clear failure reasons, forcing callers to handle both success and failure paths at the type level.

## Installation

```typescript
// Import utilities
import { validateWager, validateGameId, ValidationErrorCode } from '@/utils/v1/validation';

// Import hooks
import { useWagerValidation, useFormValidation } from '@/hooks/v1/validation';
```

## Core Concepts

### ValidationResult

All validators return a discriminated union that forces explicit error handling:

```typescript
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ValidationError };
```

### ValidationError

Structured error with machine-readable code:

```typescript
interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  field?: string;
  context?: Record<string, unknown>;
}
```

## Validators

### Wager Validation

Validates wager amounts against configurable bounds (in stroops).

```typescript
import { validateWager, DEFAULT_WAGER_BOUNDS } from '@/utils/v1/validation';

// Default bounds: 1 XLM (10,000,000 stroops) to 1000 XLM (10,000,000,000 stroops)
const result = validateWager("50000000"); // 5 XLM

if (result.success) {
  console.log("Valid wager:", result.data); // bigint
} else {
  console.error(result.error.message);
}

// Custom bounds
const customResult = validateWager("3000", { min: 1000n, max: 5000n });
```

**Accepts:** `bigint | string | number | null | undefined`  
**Returns:** `ValidationResult<bigint>`

**Error Codes:**
- `REQUIRED` - Value is null, undefined, or empty
- `INVALID_TYPE` - Cannot parse as bigint
- `OUT_OF_RANGE` - Below minimum, above maximum, or zero/negative

### ID Validation

Validates game IDs and badge IDs (u64 represented as bigint).

```typescript
import { validateGameId, validateBadgeId } from '@/utils/v1/validation';

const gameResult = validateGameId("12345");
const badgeResult = validateBadgeId(42n);

if (gameResult.success) {
  console.log("Game ID:", gameResult.data); // 12345n
}
```

**Accepts:** `bigint | string | number | null | undefined`  
**Returns:** `ValidationResult<bigint>`

**Error Codes:**
- `REQUIRED` - Value is null, undefined, or empty
- `INVALID_TYPE` - Cannot parse as bigint
- `OUT_OF_RANGE` - Negative value

### Enum Validation

Validates that a value is one of the allowed enum values.

```typescript
import { validateEnum } from '@/utils/v1/validation';

const sides = ["heads", "tails"] as const;
const result = validateEnum("heads", sides, "side");

if (result.success) {
  console.log("Valid side:", result.data); // "heads"
}
```

**Accepts:** `T | null | undefined` where `T extends string`  
**Returns:** `ValidationResult<T>`

**Error Codes:**
- `REQUIRED` - Value is null, undefined, or empty
- `INVALID_ENUM` - Value not in allowed list

### Address Validation

Validates Stellar public keys (G...) and contract addresses (C...).

```typescript
import { validateStellarAddress, validateContractAddress } from '@/utils/v1/validation';

const addressResult = validateStellarAddress("GABC...");
const contractResult = validateContractAddress("CABC...");
```

**Accepts:** `string | null | undefined`  
**Returns:** `ValidationResult<string>`

**Validation Rules:**
- Must start with 'G' (public key) or 'C' (contract)
- Exactly 56 characters
- Valid base32 characters (A-Z, 2-7)
- Automatically trims whitespace

**Error Codes:**
- `REQUIRED` - Value is null, undefined, or empty
- `INVALID_ADDRESS` - Wrong prefix, length, or invalid characters

### Hash Validation

Validates SHA-256 hashes (64-character lowercase hex string).

```typescript
import { validateSha256Hash } from '@/utils/v1/validation';

const result = validateSha256Hash("a3f5c1d2...");

if (result.success) {
  console.log("Valid hash:", result.data); // lowercase hex
}
```

**Accepts:** `string | null | undefined`  
**Returns:** `ValidationResult<string>`

**Validation Rules:**
- Exactly 64 characters
- Hexadecimal characters only (0-9, a-f)
- Automatically converts to lowercase
- Automatically trims whitespace

**Error Codes:**
- `REQUIRED` - Value is null, undefined, or empty
- `INVALID_HASH` - Wrong length or invalid characters

### String Validation

Validates strings with custom length and pattern constraints.

```typescript
import { validateString } from '@/utils/v1/validation';

const result = validateString("john_doe", "username", {
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-z0-9_]+$/,
  patternDescription: "lowercase letters, numbers, and underscores"
});
```

**Accepts:** `string | null | undefined`  
**Returns:** `ValidationResult<string>`

**Options:**
- `minLength?: number` - Minimum string length
- `maxLength?: number` - Maximum string length
- `pattern?: RegExp` - Pattern to match
- `patternDescription?: string` - Human-readable pattern description

**Error Codes:**
- `REQUIRED` - Value is null, undefined, or empty
- `TOO_SHORT` - Below minimum length
- `TOO_LONG` - Above maximum length
- `INVALID_FORMAT` - Doesn't match pattern

### Number Validation

Validates numbers with optional min/max bounds.

```typescript
import { validateNumber } from '@/utils/v1/validation';

const result = validateNumber(25, "age", { min: 18, max: 100 });
```

**Accepts:** `number | string | null | undefined`  
**Returns:** `ValidationResult<number>`

**Options:**
- `min?: number` - Minimum value
- `max?: number` - Maximum value

**Error Codes:**
- `REQUIRED` - Value is null, undefined, or empty
- `INVALID_TYPE` - Cannot parse as number
- `OUT_OF_RANGE` - Below minimum or above maximum

## Helper Predicates

Type guards for precondition checks:

```typescript
import {
  isDefined,
  isNonEmptyString,
  isPositiveBigInt,
  isNonNegativeBigInt,
  isWalletConnected
} from '@/utils/v1/validation';

// Type guard: value is not null or undefined
if (isDefined(wallet)) {
  console.log(wallet.address); // TypeScript knows wallet is defined
}

// Type guard: value is a non-empty string
if (isNonEmptyString(input)) {
  console.log(input.toUpperCase()); // TypeScript knows input is string
}

// Type guard: value is a positive bigint
if (isPositiveBigInt(amount)) {
  console.log(amount + 1n); // TypeScript knows amount is bigint
}

// Type guard: value is a non-negative bigint
if (isNonNegativeBigInt(balance)) {
  console.log(balance >= 0n); // Always true
}

// Type guard: wallet is connected with valid address
if (isWalletConnected(walletAddress)) {
  console.log(walletAddress); // TypeScript knows walletAddress is string
}
```

## React Hooks

### useWagerValidation

Stateful wager validation with error tracking.

```typescript
import { useWagerValidation } from '@/hooks/v1/validation';

function WagerInput() {
  const wager = useWagerValidation("", { min: 5_000_000n, max: 100_000_000n });

  const handleSubmit = () => {
    if (wager.validate()) {
      submitBet(wager.value);
    }
  };

  return (
    <div>
      <input
        value={wager.value}
        onChange={(e) => wager.setValue(e.target.value)}
        onBlur={wager.touch}
      />
      {wager.isDirty && wager.error && (
        <span className="error">{wager.error.message}</span>
      )}
      <button onClick={handleSubmit} disabled={!wager.isValid}>
        Submit
      </button>
    </div>
  );
}
```

**API:**
- `value: string` - Current input value
- `error: ValidationError | null` - Current validation error
- `isValid: boolean` - Whether current value is valid
- `isDirty: boolean` - Whether user has interacted with input
- `setValue(value: string): void` - Update value and mark as dirty
- `validate(): boolean` - Validate current value and update error
- `reset(newValue?: string): void` - Reset to initial or new value
- `touch(): void` - Mark as dirty and validate

### useEnumValidation

Stateful enum validation.

```typescript
import { useEnumValidation } from '@/hooks/v1/validation';

function CoinSideSelector() {
  const side = useEnumValidation<"heads" | "tails">(
    "heads",
    ["heads", "tails"],
    "side"
  );

  return (
    <select value={side.value} onChange={(e) => side.setValue(e.target.value)}>
      <option value="">Select side</option>
      <option value="heads">Heads</option>
      <option value="tails">Tails</option>
    </select>
  );
}
```

### useFormValidation

Multi-field form validation.

```typescript
import { useWagerValidation, useEnumValidation, useFormValidation } from '@/hooks/v1/validation';

function BetForm() {
  const wager = useWagerValidation();
  const side = useEnumValidation<"heads" | "tails">("", ["heads", "tails"], "side");

  const form = useFormValidation({ wager, side });

  const handleSubmit = () => {
    if (form.validateAll()) {
      submitBet({ wager: wager.value, side: side.value });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={!form.isValid}>
        Submit
      </button>
    </form>
  );
}
```

**API:**
- `validateAll(): boolean` - Validate all fields and touch them
- `touchAll(): void` - Mark all fields as dirty
- `isValid: boolean` - Whether all fields are valid

### Other Hooks

- `useGameIdValidation(initialValue?: string)` - Game ID validation
- `useAddressValidation(initialValue?: string)` - Stellar address validation
- `useStringValidation(initialValue?: string, fieldName: string, constraints?: StringConstraints)` - String validation
- `useNumberValidation(initialValue?: string, fieldName: string, bounds?: NumericBounds)` - Number validation

All hooks follow the same API pattern as `useWagerValidation`.

## Error Handling

### Error Codes

```typescript
enum ValidationErrorCode {
  Required = "REQUIRED",
  InvalidType = "INVALID_TYPE",
  OutOfRange = "OUT_OF_RANGE",
  InvalidFormat = "INVALID_FORMAT",
  InvalidEnum = "INVALID_ENUM",
  TooShort = "TOO_SHORT",
  TooLong = "TOO_LONG",
  InvalidAddress = "INVALID_ADDRESS",
  InvalidHash = "INVALID_HASH",
}
```

### Error Context

Errors include context for debugging:

```typescript
const result = validateWager("abc");
if (!result.success) {
  console.log(result.error.code); // "INVALID_TYPE"
  console.log(result.error.message); // "Wager must be a valid integer"
  console.log(result.error.field); // "wager"
  console.log(result.error.context); // { value: "abc" }
}
```

## Best Practices

### 1. Always Handle Both Paths

```typescript
// ✅ Good: Explicit handling
const result = validateWager(input);
if (result.success) {
  processWager(result.data);
} else {
  showError(result.error.message);
}

// ❌ Bad: Assuming success
const result = validateWager(input);
processWager(result.data); // TypeScript error!
```

### 2. Use Type Guards for Preconditions

```typescript
// ✅ Good: Type-safe precondition check
if (isWalletConnected(walletAddress)) {
  await signTransaction(walletAddress); // TypeScript knows it's string
}

// ❌ Bad: Manual null check
if (walletAddress) {
  await signTransaction(walletAddress); // Could still be empty string
}
```

### 3. Validate Before State Mutation

```typescript
// ✅ Good: Validate before mutation
const result = validateWager(input);
if (result.success) {
  setWager(result.data);
  submitTransaction();
}

// ❌ Bad: Mutate then validate
setWager(input);
if (validateWager(input).success) {
  submitTransaction();
}
```

### 4. Use Hooks for Form State

```typescript
// ✅ Good: Stateful validation with hooks
function Form() {
  const wager = useWagerValidation();
  return <input value={wager.value} onChange={(e) => wager.setValue(e.target.value)} />;
}

// ❌ Bad: Manual state management
function Form() {
  const [wager, setWager] = useState("");
  const [error, setError] = useState(null);
  // ... manual validation logic
}
```

### 5. Centralize Validation Rules

```typescript
// ✅ Good: Use provided validators
const result = validateWager(input);

// ❌ Bad: Duplicate validation logic
if (input < 10_000_000 || input > 10_000_000_000) {
  throw new Error("Invalid wager");
}
```

## Testing

The validation module includes comprehensive unit tests covering:

- Normal behavior for all validators
- Edge cases (empty strings, null, undefined, boundary values)
- Failure paths (invalid inputs, out of range, wrong format)
- Hook state management and stability
- Form validation integration

Run tests:

```bash
npm run test:unit -- validation
```

## Security Considerations

1. **Input Sanitization**: All validators trim whitespace and normalize input
2. **Type Safety**: Validators return typed results, preventing type coercion bugs
3. **No Side Effects**: Validators are pure functions with no hidden state
4. **Deterministic**: Same input always produces same output
5. **Context Preservation**: Original errors are preserved for debugging

## Performance

- Validators are lightweight pure functions
- Hooks use `useCallback` and `useMemo` for stable references
- No unnecessary re-renders or re-validations
- Validation is synchronous (no async overhead)

## Migration Guide

If you have existing validation logic:

1. Replace manual checks with validators:
   ```typescript
   // Before
   if (!input || isNaN(Number(input))) {
     throw new Error("Invalid");
   }
   
   // After
   const result = validateNumber(input, "field");
   if (!result.success) {
     showError(result.error.message);
   }
   ```

2. Replace state management with hooks:
   ```typescript
   // Before
   const [value, setValue] = useState("");
   const [error, setError] = useState(null);
   
   // After
   const field = useStringValidation("", "fieldName");
   ```

3. Use form validation for multi-field forms:
   ```typescript
   // Before
   const validateForm = () => {
     return field1Valid && field2Valid && field3Valid;
   };
   
   // After
   const form = useFormValidation({ field1, field2, field3 });
   form.validateAll();
   ```
