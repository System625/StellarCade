# treasury

## Public Methods

### `init`
```rust
pub fn init(env: Env, admin: Address, token_address: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `token_address` | `Address` |

#### Return Type

`Result<(), Error>`

### `pause`
```rust
pub fn pause(env: Env, admin: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

#### Return Type

`Result<(), Error>`

### `unpause`
```rust
pub fn unpause(env: Env, admin: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

#### Return Type

`Result<(), Error>`

### `deposit`
```rust
pub fn deposit(env: Env, from: Address, amount: i128, reason: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `from` | `Address` |
| `amount` | `i128` |
| `reason` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `allocate`
```rust
pub fn allocate(env: Env, to_contract: Address, amount: i128, purpose: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `to_contract` | `Address` |
| `amount` | `i128` |
| `purpose` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `release`
```rust
pub fn release(env: Env, to: Address, amount: i128, purpose: Symbol) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `to` | `Address` |
| `amount` | `i128` |
| `purpose` | `Symbol` |

#### Return Type

`Result<(), Error>`

### `treasury_state`
```rust
pub fn treasury_state(env: Env) -> Result<TreasuryState, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Result<TreasuryState, Error>`

### `policy_snapshot`
Returns treasury policy and signer-threshold metadata.

```rust
pub fn policy_snapshot(env: Env) -> Result<TreasuryPolicySnapshot, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`Result<TreasuryPolicySnapshot, Error>`

