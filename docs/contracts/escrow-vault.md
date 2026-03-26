# escrow-vault

## Public Methods

### `init`
Initialize with the admin and the accepted token address.

```rust
pub fn init(env: Env, admin: Address, token_address: Address)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `token_address` | `Address` |

### `create_escrow`
Create a new escrow. The payer locks `amount` tokens into the contract.

```rust
pub fn create_escrow(env: Env, payer: Address, payee: Address, amount: i128, terms_hash: Symbol, expiry: u64) -> u64
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `payer` | `Address` |
| `payee` | `Address` |
| `amount` | `i128` |
| `terms_hash` | `Symbol` |
| `expiry` | `u64` |

#### Return Type

`u64`

### `release_escrow`
Release escrow funds to the payee. Only the admin or payer may release.

```rust
pub fn release_escrow(env: Env, caller: Address, escrow_id: u64)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `caller` | `Address` |
| `escrow_id` | `u64` |

### `cancel_escrow`
Cancel an active escrow and return funds to the payer. Admin-only.

```rust
pub fn cancel_escrow(env: Env, escrow_id: u64)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `escrow_id` | `u64` |

### `recover_escrow`
Recover funds from an expired escrow. Admin-only.

```rust
pub fn recover_escrow(env: Env, escrow_id: u64)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `escrow_id` | `u64` |

### `escrow_state`
Read the state of an escrow.

```rust
pub fn escrow_state(env: Env, escrow_id: u64) -> EscrowState
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `escrow_id` | `u64` |

#### Return Type

`EscrowState`

