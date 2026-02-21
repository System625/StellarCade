# Tournament System Contract

Manages the lifecycle of gaming tournaments on the StellarCade platform, including registration, scoring, and finalization.

## Overview

Tournaments are time-bound or round-based gaming events. This contract acts as the on-chain registry and state machine for these events. 

The lifecycle of a tournament is:
1. **Creation**: Admin defines a tournament with a unique ID, rules (off-chain hash), and an entry fee.
2. **Joining**: Players join the tournament by paying the entry fee (recorded via events).
3. **Gaming**: Results/scores are recorded by authorized admins or game servers.
4. **Finalization**: The tournament is closed. No further joins or score updates are permitted.

Rewards and fee collection are orchestrated via emitted events, integrating with the platform's `PrizePool` and other payout systems.

## Methods

### `init(admin: Address, fee_contract: Address, reward_contract: Address) → Result<(), Error>`

Initialize the tournament system. May only be called once.

- `admin` — authorized to create tournaments, record scores, and finalize.
- `fee_contract` — address of the contract handling entry fees (stored for reference).
- `reward_contract` — address of the contract handling payouts (stored for reference).

### `create_tournament(admin, id, rules_hash, entry_fee) → Result<(), Error>`

Define a new tournament. Admin only.

- `id: u64` — unique identifier.
- `rules_hash: BytesN<32>` — SHA-256 hash of the tournament rules and configuration.
- `entry_fee: i128` — token amount required to join.

**Event:** `TournamentCreated { id, rules_hash, entry_fee }`

### `join_tournament(player, id) → Result<(), Error>`

Register a player for a tournament. Player must authorize.

- Tournament must exist and be in `Active` status.
- Player cannot join the same tournament twice.

**Event:** `PlayerJoined { id, player, fee_paid }`

### `record_result(admin, id, player, score) → Result<(), Error>`

Record a player's achievement in a tournament. Admin only.

- Player must have previously joined the tournament.
- Tournament must be `Active`.

**Event:** `ResultRecorded { id, player, score }`

### `finalize_tournament(admin, id) → Result<(), Error>`

Close the tournament. Admin only. 

- Prevents any further registrations or score updates.
- Once finalized, a tournament cannot be re-opened.

**Event:** `TournamentFinalized { id }`

---

## Events

| Event | Topics | Data | Description |
|-------|--------|------|-------------|
| `TournamentCreated` | `id` | `rules_hash`, `entry_fee` | New tournament defined |
| `PlayerJoined` | `id`, `player` | `fee_paid` | Player registered for events |
| `ResultRecorded` | `id`, `player` | `score` | Player score recorded |
| `TournamentFinalized` | `id` | — | Tournament closed |

---

## Storage

| Key | Kind | Type | Description |
|-----|------|------|-------------|
| `Admin` | instance | `Address` | Platform administrator |
| `FeeContract` | instance | `Address` | Fee handling contract |
| `RewardContract` | instance | `Address` | Reward handling contract |
| `Tournament(id)` | persistent | `TournamentData` | Rules, fee, and status |
| `PlayerJoined(id, addr)` | persistent | `bool` | Enrollment record |
| `PlayerScore(id, addr)` | persistent | `u64` | Player's recorded score |

TTL for persistent entries is bumped to ~30 days on every write.

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1 | `AlreadyInitialized` | `init` called more than once |
| 2 | `NotInitialized` | Method called before `init` |
| 3 | `NotAuthorized` | Caller not authorized for operation |
| 4 | `InvalidAmount` | Negative entry fee |
| 5 | `TournamentNotFound` | Tournament ID does not exist |
| 6 | `TournamentAlreadyExists`| ID collision on creation |
| 7 | `TournamentNotActive` | Join/Score attempted on closed tournament |
| 8 | `TournamentAlreadyFinalized`| Finalizing an already final tournament |
| 9 | `PlayerAlreadyJoined` | Duplicate registration |
| 10| `PlayerNotJoined` | Score recorded for non-registrant |

---

## Integration Assumptions

- **Fee Collection**: `PlayerJoined` events trigger off-chain billing or downstream contract calls to `FeeContract`.
- **Payouts**: `TournamentFinalized` triggers an off-chain leaderboard calculation and calls `RewardContract` (e.g., `PrizePool.payout`) to reward winners.
- **Depends on**: Issues #25, #26, #27, #28, #36 for platform-wide ID and auth consistency.
