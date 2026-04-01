# ai-generated-game

Read model returned by `get_session_snapshot`.  Exposes enough state for a client to resume an in-progress session without leaking sensitive prompt internals. The `prompt_hash` field is the SHA-256 commitment stored at game creation — it is safe to expose for verification purposes but does NOT reveal the underlying prompt content.  Fields intentionally omitted (redacted): - Raw prompt / config payload (never stored on-chain; only the hash is kept) - Oracle result payload (stored off-chain; not part of on-chain state) - Internal reward-claim flags (private accounting detail)

## Public Methods

### `init`
Initialize the contract with the admin, AI model oracle address, and reward system address.

```rust
pub fn init(env: Env, admin: Address, model_oracle: Address, reward_contract: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `model_oracle` | `Address` |
| `reward_contract` | `Address` |

#### Return Type

`Result<(), Error>`

### `create_ai_game`
Setup a new AI-generated game layout.

```rust
pub fn create_ai_game(env: Env, admin: Address, game_id: u64, config_hash: BytesN<32>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `game_id` | `u64` |
| `config_hash` | `BytesN<32>` |

#### Return Type

`Result<(), Error>`

### `submit_ai_move`
Player submitting a move towards an active AI game.

```rust
pub fn submit_ai_move(env: Env, player: Address, game_id: u64, move_payload: String) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `game_id` | `u64` |
| `move_payload` | `String` |

#### Return Type

`Result<(), Error>`

### `resolve_ai_game`
Oracle node resolves the game securely mapping outputs and winners systematically.

```rust
pub fn resolve_ai_game(env: Env, oracle: Address, game_id: u64, result_payload: String, winner: Option<Address>) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `oracle` | `Address` |
| `game_id` | `u64` |
| `result_payload` | `String` |
| `winner` | `Option<Address>` |

#### Return Type

`Result<(), Error>`

### `get_session_snapshot`
Returns a stable read-only snapshot of a session for client resume flows.  Safe to call without authentication — no sensitive internals are exposed. Returns a deterministic `Missing` snapshot when the game_id is unknown, so callers never need to handle a hard error for a simple lookup.

```rust
pub fn get_session_snapshot(env: Env, game_id: u64) -> SessionSnapshot
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `game_id` | `u64` |

#### Return Type

`SessionSnapshot`

### `claim_ai_reward`
Authorizes player to claim rewards mapped after oracle validation finishes.

```rust
pub fn claim_ai_reward(env: Env, player: Address, game_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `game_id` | `u64` |

#### Return Type

`Result<(), Error>`

