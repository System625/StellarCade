# Emergency Pause Contract

A reusable pause mechanism for halting critical operations during incidents.

## Public Interface

| Function | Description |
|----------|-------------|
| `init(admin)` | Set the admin who can pause/unpause. One-time call. |
| `pause(admin)` | Pause the contract. Emits a `paused` event. |
| `unpause(admin)` | Unpause the contract. Emits an `unpaused` event. |
| `is_paused()` | Returns `true` if currently paused. |

## Error Codes

| Code | Meaning |
|------|---------|
| 1 | Already initialized |
| 2 | Not initialized |
| 3 | Not authorized (caller is not admin) |
| 4 | Already paused |
| 5 | Not paused |

## Integration Guide

Game contracts and admin-sensitive contracts should integrate the pause guard
to fail fast when the platform is paused.

### Option 1: Import as a library (recommended)

Add the dependency to your contract's `Cargo.toml`:

```toml
[dependencies]
stellarcade-emergency-pause = { path = "../emergency-pause" }
```

Use the guard in your contract functions:

```rust
use stellarcade_emergency_pause::require_not_paused;

pub fn play(env: Env, player: Address, amount: i128) -> Result<(), Error> {
    require_not_paused(&env);
    // ... game logic
}
```

This reads the pause flag directly from instance storage, so the pause state
must live in the same contract instance. If you need pause state shared across
contracts, use Option 2.

### Option 2: Cross-contract call

Deploy `EmergencyPause` as a standalone contract and call `is_paused()` from
other contracts:

```rust
let pause_client = EmergencyPauseClient::new(&env, &pause_contract_addr);
if pause_client.is_paused() {
    panic!("Platform is paused");
}
```

## Running Tests

```bash
cd contracts/emergency-pause
cargo test
```
