# Stellarcade Smart Contracts

This folder contains the Soroban smart contracts for the Stellarcade platform. All contracts are written in Rust using the Soroban SDK.

## 📂 Contract Structure

```
contracts/
├── shared/                 # Common types and utilities
├── prize-pool/            # Manages deposits, fees, and distributions
├── treasury/              # Platform treasury for fund allocation
├── random-generator/      # Provably fair RNG contract
├── coin-flip/             # Head-or-tails game
├── daily-trivia/          # Trivia game with reward settlement
├── leaderboard/           # Score tracking and rankings
├── governance-token/      # Platform utility and voting token
├── cross-chain-bridge/    # Asset transfers between chains
├── access-control/        # Role-based access management
├── achievement-badge/     # NFT achievement badges
├── ...                    # Additional game and utility contracts
└── Cargo.toml             # Workspace configuration
```

### Contract Categories

**Core Infrastructure:**

- `shared/` - Common types, traits, and utilities
- `access-control/` - Role-based permissions
- `treasury/` - Fund management and allocation

**Gaming Contracts:**

- `coin-flip/` - Classic coin flip game
- `daily-trivia/` - Daily trivia challenges
- `dice-roll/` - Dice rolling game
- `number-guess/` - Number guessing game
- `pattern-puzzle/` - Pattern matching puzzles
- `wordle-clone/` - Wordle-style game

**Platform Features:**

- `prize-pool/` - Prize pool management
- `leaderboard/` - Global rankings
- `achievement-badge/` - Achievement NFTs
- `governance-token/` - Governance and voting
- `staking/` - Token staking rewards

**Utilities:**

- `random-generator/` - Provably fair randomness
- `cross-chain-bridge/` - Cross-chain asset transfers
- `emergency-pause/` - Circuit breaker functionality

## 🛠 Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup)
- `wasm32-unknown-unknown` target

### Install Prerequisites

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Soroban CLI
cargo install --locked stellar-cli

# Or on macOS
brew install stellar-cli

# Add wasm32 target
rustup target add wasm32-unknown-unknown

# Verify installation
stellar --version
rustc --version
```

## 🚀 Building & Testing

### Build All Contracts

From the `contracts/` directory:

```bash
# Build all contracts in the workspace
soroban contract build

# Or using cargo directly
cargo build --target wasm32-unknown-unknown --release
```

### Build a Specific Contract

```bash
cd prize-pool

# Build the contract
cargo build --target wasm32-unknown-unknown --release

# Or using Soroban CLI
stellar contract build
```

### Run Tests

```bash
# Run all contract tests
cargo test

# Run tests for a specific contract
cd prize-pool && cargo test

# Run tests with output
cargo test -- --nocapture

# Run a specific test
cargo test test_deposit
```

### Generate Documentation

```bash
# Generate contract documentation
cargo doc --no-deps

# Open documentation in browser
cargo doc --no-deps --open
```

## 🔧 Development Commands

```bash
# Build all contracts
soroban contract build

# Run all tests
cargo test

# Run tests with verbose output
cargo test --verbose

# Check code without building
cargo check

# Format code
cargo fmt

# Lint code
cargo clippy -- -D warnings

# Generate documentation
cargo doc --no-deps
```

## 📋 Contract Development Workflow

### 1. Create a New Contract

```bash
# Create new contract directory
mkdir my-game
cd my-game

# Initialize Rust project
cargo init --name my_game

# Add Soroban SDK dependency
cargo add stellar-contract --git https://github.com/stellar/rs-soroban-sdk --rev main
cargo add stellar-contract-env --git https://github.com/stellar/rs-soroban-sdk --rev main
```

### 2. Implement Contract Logic

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, Address};

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn hello(env: Env, to: Address) -> Symbol {
        Symbol::new(&env, "Hello, World!")
    }
}
```

### 3. Write Tests

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, Address};

    #[test]
    fn test_hello() {
        let env = Env::default();
        let contract_id = env.register_contract(None, MyContract);
        let client = MyContractClient::new(&env, &contract_id);

        let to = Address::generate(&env);
        let result = client.hello(&to);

        assert_eq!(result, Symbol::new(&env, "Hello, World!"));
    }
}
```

### 4. Build and Test

```bash
# Build
cargo build --target wasm32-unknown-unknown --release

# Test
cargo test
```

## 🔐 Security Considerations

All contracts follow security best practices:

- **Authorization**: Use Soroban's built-in authorization framework
- **Overflow Protection**: Enable overflow checks in release builds
- **Access Control**: Implement role-based permissions where needed
- **Input Validation**: Validate all external inputs
- **Event Logging**: Emit events for important state changes
- **Gas Optimization**: Minimize storage and compute usage

### Security Checklist

- [ ] All arithmetic operations use checked arithmetic
- [ ] External calls use proper authorization
- [ ] State changes emit events
- [ ] Access control is properly implemented
- [ ] No recursive calls that could exceed compute limits
- [ ] Storage keys are properly namespaced
- [ ] All tests pass including edge cases

## 📦 Adding a Contract to Workspace

To add a new contract to the workspace:

1. Create the contract in a new directory
2. Add it to `Cargo.toml` workspace members:

```toml
[workspace]
members = [
    # ... existing members
    "my-new-contract",
]
```

3. Build and test to verify integration

## ✅ Verification Checklist

After working with contracts:

- [ ] All contracts build without errors
- [ ] All tests pass (`cargo test`)
- [ ] Code is formatted (`cargo fmt`)
- [ ] No clippy warnings (`cargo clippy`)
- [ ] Documentation is up to date
- [ ] Security considerations are addressed

## 🔍 Troubleshooting

### Build Errors

**Error:** `cannot find type 'Env' in this scope`

**Solution:** Ensure you have the correct imports:

```rust
use soroban_sdk::Env;
```

**Error:** `target wasm32-unknown-unknown is not installed`

**Solution:**

```bash
rustup target add wasm32-unknown-unknown
```

**Error:** `overflow checking requires panic = "abort"`

**Solution:** Add to `Cargo.toml`:

```toml
[profile.release]
panic = "abort"
overflow-checks = true
```

### Test Failures

**Error:** Tests fail with authorization errors

**Solution:** Ensure proper test setup with mocked authorization:

```rust
let env = Env::default();
env.mock_all_auths();
```

### Soroban CLI Issues

**Error:** `stellar: command not found`

**Solution:**

```bash
# Install or update
cargo install --locked stellar-cli

# Or update if already installed
stellar --version
```

## 📚 Related Documentation

- [Complete Setup Guide](../docs/SETUP.md) - End-to-end local development setup
- [Architecture](../docs/ARCHITECTURE.md) - System design overview
- [Game Rules](../docs/GAME_RULES.md) - Game mechanics
- [Deployment Guide](../docs/DEPLOYMENT.md) - Production deployment
- [Soroban Documentation](https://soroban.stellar.org/docs) - Official Soroban docs

## 🎯 Contract Status

| Contract         | Status         | Tests      | Audit      |
| ---------------- | -------------- | ---------- | ---------- |
| prize-pool       | ✅ Complete    | ✅ Passing | ⏳ Pending |
| treasury         | ✅ Complete    | ✅ Passing | ⏳ Pending |
| random-generator | ✅ Complete    | ✅ Passing | ⏳ Pending |
| coin-flip        | ✅ Complete    | ✅ Passing | ⏳ Pending |
| daily-trivia     | ✅ Complete    | ✅ Passing | ⏳ Pending |
| leaderboard      | ✅ Complete    | ✅ Passing | ⏳ Pending |
| governance-token | 🚧 In Progress | 🔄 WIP     | ⏳ Pending |

---

_For more details, see the README in each contract subdirectory._

_Built with ❤️ for the Stellarcade community._
