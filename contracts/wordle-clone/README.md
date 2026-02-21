# Wordle Clone Contract

An on-chain Wordle-style daily word game built with Soroban smart contracts. Players submit up to 6 guesses for a hidden 5-letter word. After the admin finalizes the puzzle, each guess is scored and winners are recorded.

## Rules

- The answer is exactly 5 bytes (characters).
- Each player may submit at most 6 guesses per puzzle.
- A player wins if any of their guesses exactly matches the answer.
- Scoring uses the standard Wordle algorithm (see **Scoring** below).
- The answer is hidden via commit-reveal: only the SHA-256 hash is stored on-chain until the admin reveals it.

## Scoring

Each byte of a guess is assigned one of three scores:

| Score | Value | Meaning |
|---|---|---|
| `CORRECT` | `2` | Right letter, right position |
| `PRESENT` | `1` | Right letter, wrong position |
| `ABSENT`  | `0` | Letter not in the answer |

The algorithm resolves exact matches first, then marks remaining letters PRESENT if they appear in unused answer positions. Each answer letter accounts for at most one PRESENT mark (prevents double-counting duplicates).

## Public Interface

### `init(admin, prize_pool_contract, balance_contract)`

Initialize the contract. May only be called once.

- `admin` — Address that may create puzzles, reveal answers, and finalize results.
- `prize_pool_contract` — Prize pool contract address (stored for future reward integration).
- `balance_contract` — Balance contract address (stored for future reward integration).

### `create_daily_puzzle(puzzle_id, answer_commitment)`

Create a new daily puzzle. **Admin only.**

- `puzzle_id` — Unique identifier (u64) for the puzzle.
- `answer_commitment` — `SHA-256(plaintext_answer)` computed off-chain.

Emits `PuzzleCreated`.

### `submit_attempt(player, puzzle_id, attempt)`

Submit a 5-byte guess for an open puzzle. **Player auth required.**

- `player` — Submitting player's address.
- `puzzle_id` — Target puzzle.
- `attempt` — Exactly 5 bytes (enforced on-chain).

Attempts are accepted while the puzzle status is `Open` (before `reveal_answer`). A player may submit at most `MAX_ATTEMPTS` (6) guesses. Their first guess registers them in the player list.

Emits `AttemptSubmitted`.

### `reveal_answer(puzzle_id, answer)`

Reveal the plaintext answer. **Admin only.**

- `puzzle_id` — Puzzle to reveal.
- `answer` — Plaintext 5-byte answer. Must satisfy `SHA-256(answer) == answer_commitment`.

Verifies the commitment before storing the answer. Transitions the puzzle from `Open` to `Revealed`. No new player guesses are accepted after this call.

Emits `AnswerRevealed`.

### `finalize_result(player, puzzle_id)`

Score all player attempts and record winners. **Admin only.**

- `player` — Included per the required public interface; scoring covers all registered players.
- `puzzle_id` — Puzzle to finalize.

Requires the puzzle to be in `Revealed` state. Iterates every player's attempts (bounded by `MAX_PLAYERS_PER_PUZZLE × MAX_ATTEMPTS`), fills in per-character scores, and marks winners. Transitions the puzzle to `Finalized`.

Emits `PuzzleFinalized`.

### `get_attempts(player, puzzle_id) → Vec<Attempt>`

Return all attempts for a player. The `scores` field of each `Attempt` is empty before finalization and populated afterward.

### `get_puzzle(puzzle_id) → Option<PuzzleData>`

Return puzzle metadata.

### `is_winner(puzzle_id, player) → bool`

Return `true` if the player solved the puzzle.

## Events

| Event | Topics | Fields |
|---|---|---|
| `PuzzleCreated` | `puzzle_id` | `answer_commitment` |
| `AttemptSubmitted` | `puzzle_id`, `player` | `attempt_number`, `guess` |
| `AnswerRevealed` | `puzzle_id` | — |
| `PuzzleFinalized` | `puzzle_id` | `answer`, `winner_count` |

## Storage

### Instance storage (contract config, single ledger entry)

| Key | Type | Description |
|---|---|---|
| `Admin` | `Address` | Contract admin |
| `PrizePoolContract` | `Address` | Prize pool contract address |
| `BalanceContract` | `Address` | Balance contract address |

### Persistent storage (per-puzzle and per-player, TTL ~30 days)

| Key | Type | Description |
|---|---|---|
| `Puzzle(puzzle_id)` | `PuzzleData` | Puzzle metadata and result summary |
| `PlayerList(puzzle_id)` | `Vec<Address>` | All players who submitted at least one attempt |
| `Attempts(puzzle_id, player)` | `Vec<Attempt>` | Player's attempts (with scores after finalization) |
| `Winner(puzzle_id, player)` | `bool` | Set when a player solves the puzzle |

TTL is extended on every write using `PERSISTENT_BUMP_LEDGERS` (518,400 ledgers ≈ 30 days at 5 s/ledger).

## State Machine

```
Open ──(reveal_answer)──▶ Revealed ──(finalize_result)──▶ Finalized
```

- `Open`: accepting player guesses.
- `Revealed`: answer stored on-chain; no new guesses accepted.
- `Finalized`: all attempts scored; winner flags set.

## Security / Invariants

- **Role checks**: only the stored admin may call `create_daily_puzzle`, `reveal_answer`, and `finalize_result`.
- **Commit-reveal**: `reveal_answer` verifies `SHA-256(answer) == answer_commitment` before storing the answer, preventing admin from changing the answer after guesses are submitted.
- **Attempt cap**: each player is limited to `MAX_ATTEMPTS` (6) guesses; additional calls return `TooManyAttempts`.
- **Word length**: guesses and the revealed answer must be exactly `WORD_LENGTH` (5) bytes.
- **Player cap**: `MAX_PLAYERS_PER_PUZZLE` (1,000) bounds O(n) iteration in `finalize_result`.
- **State guards**: operations that are invalid for the current puzzle state are rejected with specific errors (`PuzzleNotOpen`, `PuzzleAlreadyFinalized`, `AnswerNotRevealed`).
- **Overflow protection**: all arithmetic uses `checked_add` / `checked_div`.
- **Duplicate scoring**: the Wordle algorithm ensures each answer letter accounts for at most one PRESENT or CORRECT mark.

## Integration Assumptions

- **Prize pool**: the `PrizePoolContract` and `BalanceContract` addresses are stored at init time for future reward integration. Current implementation records winners on-chain; actual token payouts can be wired into `finalize_result` once the prize pool interface is stable (see companion contracts).
- **Puzzle IDs**: callers are responsible for uniqueness (e.g., using an epoch-day timestamp as `puzzle_id`).
- **Byte encoding**: guesses and answers are raw byte arrays. Callers should agree on encoding (e.g., uppercase ASCII) off-chain; the contract enforces length only.

## Tests

```bash
cd contracts/wordle-clone
cargo test
cargo clippy -- -D warnings
```

Test coverage includes:
- Full happy path (winner + loser, correct scoring)
- Scoring correctness: all correct, present/absent, duplicate letters
- All failure paths: wrong admin, commitment mismatch, invalid length, too many attempts, duplicate puzzle, submit after reveal/finalize, double finalize, finalize without reveal
- Winner on last (6th) guess
- Multiple winners
- Empty `get_attempts` for unknown player
