# Color Prediction Game Contract

A Soroban smart contract for StellarCade's Color Prediction game. Players wager on which color will be selected next; an admin resolves each game by declaring the winning color, and winners split the pot equally.

## Game Flow

1. **Init** — Admin deploys and calls `init` to register the admin, RNG contract, prize pool contract, and balance contract.
2. **Place Prediction** — Players call `place_prediction(player, color, wager, game_id)`. A game is created lazily on the first prediction for a given `game_id`. Each player may predict at most once per game.
3. **Resolve** — Admin calls `resolve_prediction(game_id, winning_color)`. All predictions are iterated; players who chose the correct color are counted as winners.
4. **Inspect** — Anyone calls `get_game(game_id)` to read the final state including `winning_color`, `winner_count`, and `total_pot`.

## Public Interface

### `init(admin, rng_contract, prize_pool_contract, balance_contract) -> Result<(), Error>`

Initialize the contract. May only be called once.

| Parameter             | Type    | Description                               |
|-----------------------|---------|-------------------------------------------|
| `admin`               | Address | Super-admin; required to resolve games    |
| `rng_contract`        | Address | Reserved for future RNG integration       |
| `prize_pool_contract` | Address | Reserved for prize distribution calls     |
| `balance_contract`    | Address | Reserved for token transfer calls         |

### `place_prediction(player, color, wager, game_id) -> Result<(), Error>`

Place a color prediction for a game. Creates the game on first use.

| Parameter | Type    | Description                                      |
|-----------|---------|--------------------------------------------------|
| `player`  | Address | Predictor (must authorize this call)             |
| `color`   | u32     | 0=Red, 1=Green, 2=Blue, 3=Yellow                 |
| `wager`   | i128    | Token amount to wager (must be > 0)              |
| `game_id` | u64     | Unique identifier for this prediction round      |

### `resolve_prediction(game_id, winning_color) -> Result<(), Error>`

Declare the winning color for a game. Admin only. Transitions game to `Resolved`.

| Parameter       | Type | Description                            |
|-----------------|------|----------------------------------------|
| `game_id`       | u64  | Game to resolve                        |
| `winning_color` | u32  | The correct color (0–3)               |

### `get_game(game_id) -> Option<GameData>`

Return current game state, or `None` if the game has not been started.

## Color Values

| Constant        | Value | Color  |
|-----------------|-------|--------|
| `COLOR_RED`     | 0     | Red    |
| `COLOR_GREEN`   | 1     | Green  |
| `COLOR_BLUE`    | 2     | Blue   |
| `COLOR_YELLOW`  | 3     | Yellow |

## Events

### `PredictionPlaced`

Emitted when a player places a prediction.

| Field     | Type    | Topic |
|-----------|---------|-------|
| `game_id` | u64     | Yes   |
| `player`  | Address | Yes   |
| `color`   | u32     | No    |
| `wager`   | i128    | No    |

### `PredictionResolved`

Emitted when a game is resolved.

| Field           | Type | Topic |
|-----------------|------|-------|
| `game_id`       | u64  | Yes   |
| `winning_color` | u32  | No    |
| `winner_count`  | u32  | No    |
| `total_pot`     | i128 | No    |

## Storage

### Instance (contract-level config)

| Key                | Type    | Description                      |
|--------------------|---------|----------------------------------|
| `Admin`            | Address | Contract admin                   |
| `RngContract`      | Address | RNG contract address             |
| `PrizePoolContract`| Address | Prize pool contract address      |
| `BalanceContract`  | Address | Balance/token contract address   |

### Persistent (per-game and per-player)

| Key                       | Type              | TTL     | Description                          |
|---------------------------|-------------------|---------|--------------------------------------|
| `Game(game_id)`           | `GameData`        | 30 days | Game metadata and totals             |
| `PlayerList(game_id)`     | `Vec<Address>`    | 30 days | All predictors for a game            |
| `Prediction(game_id, addr)` | `PredictionEntry` | 30 days | A player's color choice and wager    |

## Error Codes

| Code | Name                | Description                                         |
|------|---------------------|-----------------------------------------------------|
| 1    | `AlreadyInitialized`| `init` called more than once                        |
| 2    | `NotInitialized`    | Contract has not been initialized                   |
| 3    | `NotAuthorized`     | Caller is not the admin                             |
| 4    | `InvalidColor`      | Color value out of range (must be 0–3)              |
| 5    | `InvalidAmount`     | Wager is zero or negative                           |
| 6    | `GameNotFound`      | No game exists for the given `game_id`              |
| 7    | `GameAlreadyResolved` | Game has already been resolved                    |
| 8    | `AlreadyPredicted`  | Player has already placed a prediction for this game|
| 9    | `GameFull`          | Game has reached `MAX_PLAYERS_PER_GAME` (500)       |
| 10   | `Overflow`          | Arithmetic overflow detected                        |

## Invariants

- A game transitions from `Open` → `Resolved` exactly once.
- `total_pot == sum of all wagers` for a game.
- `player_count == len(PlayerList)` at all times.
- `winner_count ≤ player_count` after resolution.
- Each player has at most one `PredictionEntry` per game.

## Integration Assumptions

- **prize_pool_contract**: Should be invoked in `resolve_prediction` to distribute `total_pot / winner_count` tokens to each winning player. Currently a TODO pending `#3` and `#8` contract availability.
- **balance_contract**: Should be invoked in `place_prediction` to transfer wager tokens from the player into this contract. Currently a TODO pending `#2` and `#9`.
- **rng_contract**: Reserved for a future variant where the winning color is determined by an on-chain RNG oracle rather than admin declaration. Depends on `#7`.

## Dependencies

- Depends on `#2` (balance contract), `#3` (prize pool), `#7` (random generator), `#8`, and `#9` for full production integration.
