# trivia-game

## Public Methods

### `init`
Initialize the contract once with an admin who can configure rounds.

```rust
pub fn init(env: Env, admin: Address) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |

#### Return Type

`Result<(), Error>`

### `configure_round`
Configure a round and its question-set metadata.

```rust
pub fn configure_round(env: Env, admin: Address, round_id: u64, question_set_id: u64, question_count: u32, category: String, difficulty: u32, starts_at: u64, ends_at: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `round_id` | `u64` |
| `question_set_id` | `u64` |
| `question_count` | `u32` |
| `category` | `String` |
| `difficulty` | `u32` |
| `starts_at` | `u64` |
| `ends_at` | `u64` |

#### Return Type

`Result<(), Error>`

### `activate_round`
Mark a configured round as active.

```rust
pub fn activate_round(env: Env, admin: Address, round_id: u64) -> Result<(), Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `admin` | `Address` |
| `round_id` | `u64` |

#### Return Type

`Result<(), Error>`

### `submit_answer`
Submit an answer for the current active round.  The method records participation metadata only; answer validation remains out of scope for this contract stub.

```rust
pub fn submit_answer(env: Env, player: Address, question_id: u32, answer: String)
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `player` | `Address` |
| `question_id` | `u32` |
| `answer` | `String` |

### `claim_reward`
Claim rewards for a correct answer.

```rust
pub fn claim_reward(_env: Env, player: Address, _game_id: u32)
```

#### Parameters

| Name | Type |
|------|------|
| `_env` | `Env` |
| `player` | `Address` |
| `_game_id` | `u32` |

### `question_set_metadata`
Return the display-safe question-set metadata for a configured round.

```rust
pub fn question_set_metadata(env: Env, round_id: u64) -> Result<QuestionSetMetadata, Error>
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |
| `round_id` | `u64` |

#### Return Type

`Result<QuestionSetMetadata, Error>`

### `active_round_snapshot`
Return a deterministic snapshot of the active round, if one exists.  When no round is active the snapshot is zeroed with `has_active_round = false`.

```rust
pub fn active_round_snapshot(env: Env) -> ActiveRoundSnapshot
```

#### Parameters

| Name | Type |
|------|------|
| `env` | `Env` |

#### Return Type

`ActiveRoundSnapshot`

