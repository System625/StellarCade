# Number Guess Contract

A provably fair number-guessing game on the Stellar blockchain using Soroban smart contracts.  Players choose a range `[min, max]`, place a wager, and commit a guess **before** the secret number is revealed — ensuring neither the house nor any external observer can manipulate the outcome.

---

## Game Flow

```
start_game  →  submit_guess  →  (oracle fulfills RNG)  →  resolve_game
```

1. **`start_game`** — Player selects range and wager.  Tokens are transferred to the contract; a randomness request is registered with the Random Generator contract.
2. **`submit_guess`** — Player locks in their guess on-chain while the RNG request is still pending, so the oracle cannot choose a seed after seeing the guess.
3. **Oracle** fulfills the randomness off-chain by calling `RandomGenerator::fulfill_random`.
4. **`resolve_game`** — Anyone calls this to derive the secret number from the RNG result and settle the payout.

---

## Public Interface

### `init`

```rust
pub fn init(
    env: Env,
    admin: Address,
    rng_contract: Address,
    prize_pool_contract: Address,
    balance_contract: Address,  // SEP-41 token used for wagers
    min_wager: i128,
    max_wager: i128,
    house_edge_bps: i128,       // e.g. 250 = 2.5 %
) -> Result<(), Error>
```

May only be called once.  Sets all contract-level configuration in instance storage.

### `start_game`

```rust
pub fn start_game(
    env: Env,
    player: Address,
    min: u32,
    max: u32,
    wager: i128,
    game_id: u64,
) -> Result<(), Error>
```

- `player.require_auth()` — only the player can start a game on their behalf.
- Validates `min < max` and `range_size ≤ MAX_RANGE_SIZE` (1 000 000).
- Validates `wager ∈ [min_wager, max_wager]`.
- Transfers `wager` tokens from `player` to this contract.
- Registers a randomness request `(game_id, range_size)` with the RNG contract.
- Emits `GameStarted`.

### `submit_guess`

```rust
pub fn submit_guess(env: Env, game_id: u64, guess: u32) -> Result<(), Error>
```

- Reads `game.player` from storage and calls `game.player.require_auth()` — only the game's owner may guess.
- Rejects guesses outside `[min, max]`.
- Transitions game status `Open → Guessed`.
- Emits `GuessSubmitted`.

### `resolve_game`

```rust
pub fn resolve_game(env: Env, game_id: u64) -> Result<(), Error>
```

- No authorization required — the outcome is deterministic.
- Requires status `Guessed` (returns `GuessNotSubmitted` if `Open`, `GameAlreadyResolved` if `Won`/`Lost`).
- Returns `RngNotFulfilled` if the oracle has not yet called `fulfill_random` for this `game_id`.
- Derives secret: `min + (rng_result % range_size)`.
- Computes payout on win:
  - `gross = wager × range_size`
  - `fee   = gross × house_edge_bps / 10_000`
  - `net   = gross − fee`
- Writes final state **before** the token transfer (reentrancy guard).
- Emits `GameResolved`.

### `get_game`

```rust
pub fn get_game(env: Env, game_id: u64) -> Result<Game, Error>
```

Returns the full `Game` struct, or `GameNotFound`.

---

## Events

| Event | Topics | Fields |
|---|---|---|
| `GameStarted` | `game_id`, `player` | `min`, `max`, `wager` |
| `GuessSubmitted` | `game_id`, `player` | `guess` |
| `GameResolved` | `game_id`, `player` | `guess`, `secret`, `won`, `payout` |

---

## Storage

| Key | Storage | Type | Description |
|---|---|---|---|
| `Admin` | instance | `Address` | Contract administrator |
| `RngContract` | instance | `Address` | Random Generator contract |
| `PrizePoolContract` | instance | `Address` | Prize pool (reserved) |
| `BalanceContract` | instance | `Address` | SEP-41 token for wagers |
| `MinWager` | instance | `i128` | Inclusive wager lower bound |
| `MaxWager` | instance | `i128` | Inclusive wager upper bound |
| `HouseEdgeBps` | instance | `i128` | House take in basis points |
| `Game(game_id)` | persistent | `Game` | Per-game state |

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| 1 | `AlreadyInitialized` | `init` called more than once |
| 2 | `NotInitialized` | Contract not yet initialized |
| 3 | `NotAuthorized` | Caller is not the admin |
| 4 | `InvalidAmount` | Non-positive wager or bad init parameter |
| 5 | `InvalidRange` | `min ≥ max` or `range_size > MAX_RANGE_SIZE` |
| 6 | `GameAlreadyExists` | `game_id` already in use |
| 7 | `GameNotFound` | No game with this `game_id` |
| 8 | `AlreadyGuessed` | `submit_guess` called twice |
| 9 | `GameNotOpen` | Action requires `Open` status |
| 10 | `GuessNotSubmitted` | `resolve_game` requires a committed guess |
| 11 | `GameAlreadyResolved` | Game is already `Won` or `Lost` |
| 12 | `RngNotFulfilled` | Oracle has not yet provided randomness |
| 13 | `GuessOutOfRange` | Guess is outside `[min, max]` |
| 14 | `WagerTooLow` | Wager below `min_wager` |
| 15 | `WagerTooHigh` | Wager above `max_wager` |
| 16 | `Overflow` | Arithmetic overflow |

---

## Game State Machine

```
                   start_game
                  ┌──────────┐
                  │   Open   │
                  └────┬─────┘
                       │ submit_guess
                  ┌────▼──────┐
                  │  Guessed  │
                  └────┬──────┘
                       │ resolve_game
             ┌─────────┴─────────┐
          won│                   │lost
        ┌────▼───┐           ┌───▼────┐
        │  Won   │           │  Lost  │
        └────────┘           └────────┘
```

---

## Security and Invariants

- **Authorization**: `start_game` and `submit_guess` both enforce `player.require_auth()`.  `resolve_game` is permissionless.
- **Reentrancy guard**: `game.status` is updated to `Won`/`Lost` and persisted *before* any token transfer.
- **Duplicate game guard**: `game_id` must not already exist in persistent storage.
- **Guess commit-before-reveal**: The player's guess is locked in while the RNG request is still pending, preventing the oracle from biasing the seed after observing the guess.
- **Safe arithmetic**: All arithmetic uses `checked_*` with explicit `Overflow` error propagation.
- **Range cap**: `MAX_RANGE_SIZE = 1_000_000` limits the payout multiplier and prevents i128 overflow for any realistic wager.

---

## Integration Assumptions

- The Random Generator contract must be deployed and the Number Guess contract must be authorized as a caller via `RandomGenerator::authorize`.
- The `balance_contract` must be a SEP-41 compliant token.
- `game_id` must be unique across the RNG contract's pending + fulfilled request space.  The caller (typically the backend) is responsible for allocating unique IDs.
- The contract must hold sufficient token balance to pay out winners.  In production this balance comes from the prize pool; during development `StellarAssetClient::mint` can pre-fund the contract.
- `prize_pool_contract` is stored but not yet wired in.  The current implementation performs direct token transfers from the contract's own balance.  Future work will route payouts through the PrizePool contract.

---

## Building and Testing

```bash
cd contracts/number-guess

# Build
cargo build --target wasm32-unknown-unknown --release

# Test
cargo test

# Lint (must pass cleanly)
cargo clippy -- -D warnings

# Format
cargo fmt
```
