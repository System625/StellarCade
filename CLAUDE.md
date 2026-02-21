# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**StellarCade** is a decentralized arcade gaming platform on the Stellar blockchain using Soroban smart contracts. The project has two main components:
- **Smart Contracts** (Rust/Soroban) — game logic and on-chain state
- **Backend API** (Node.js/Express) — REST API connecting frontend to blockchain

Most game contracts (coin-flip, prize-pool, random-generator) are stubs with TODO placeholders. The `access-control` and `pattern-puzzle` contracts are the most complete implementations and should serve as reference.

The frontend (React/Vite) directory exists but is not yet implemented.

## Smart Contract Commands

Each contract is an **independent Rust crate** — there is no workspace-level `Cargo.toml`. Commands must be run from within each contract's directory.

```bash
# Build a single contract
cd contracts/pattern-puzzle
cargo build --target wasm32-unknown-unknown --release

# Or use Soroban CLI (from contract directory)
soroban contract build

# Run tests for a specific contract
cargo test

# Lint (enforced in CI — must pass cleanly)
cargo clippy -- -D warnings

# Format (always run before committing)
cargo fmt
```

## Backend Commands

```bash
cd backend

npm install           # Install dependencies
npm run dev           # Development server with hot reload (nodemon)
npm start             # Production server
npm test              # Run tests (Jest + Supertest)
npm run test:watch    # Tests in watch mode
npm run lint          # ESLint
npm run format        # Prettier --write .
npm run migrate       # Knex database migrations
```

## Infrastructure

```bash
docker-compose up -d   # Start PostgreSQL 15, Redis 7, and Backend API
docker-compose down    # Stop all services
```

Required backend environment variables: `NODE_ENV`, `PORT`, `DATABASE_URL` (or `DB_HOST/PORT/USER/PASSWORD/NAME`), `REDIS_URL`, `JWT_SECRET`.

## Architecture

### Smart Contracts (`contracts/`)

| Contract | Status | Purpose |
|---|---|---|
| `access-control` | Implemented | Role-based access (ADMIN, OPERATOR, PAUSER, GAME roles) |
| `pattern-puzzle` | Most complete | Commit-reveal knowledge game — use as reference |
| `prize-pool` | Stub | Prize pool management and fee distribution |
| `random-generator` | Stub | Provably fair RNG (server seed + client seed + nonce) |
| `coin-flip` | Stub | 50/50 bet game calling PrizePool and RandomGenerator |
| `shared` | Present | Common types/utilities shared across contracts |

**Contract patterns to follow:**
- All contracts use `#![no_std]` (Soroban requirement)
- Authorization via `Address::require_auth()` on all caller-sensitive functions
- Use `instance()` storage for contract-lifetime data, `persistent()` for per-user/per-round data
- Emit events via `env.events().publish()` or `#[contractevent]` macro
- Use safe arithmetic (`checked_add`, `checked_div`) with explicit `Overflow` error variants
- Set reentrancy guard (e.g., `Claimed` flag) **before** external token transfers
- Release profile: `opt-level = "z"`, `overflow-checks = true`, `panic = "abort"`, `lto = true`

### Backend (`backend/src/`)

Express app using CommonJS (`require`/`module.exports`). Routes mount under `/api`:
- `/api/games` — game management
- `/api/users` — user profiles
- `/api/wallet` — wallet/balance

Key layers: `routes/` → `controllers/` → `services/` → `models/` (Knex ORM)

Infrastructure connections: `config/database.js` (PostgreSQL, pool min:2 max:10), `config/redis.js`, `config/stellar.js`.

Auth middleware (`middleware/auth.middleware.js`) expects a Bearer JWT (HS256).

**Backend code style:** single quotes, semicolons, 2-space indent, 100-char line width, LF endings. `no-unused-vars` errors except `^_` prefixed vars.

## CI/CD

GitHub Actions runs on push/PR to `main` or `develop`:
- **`test-backend.yml`**: lint + `npm test`
- **`test-contracts.yml`**: builds and tests each contract individually (shared → prize-pool → random-generator → coin-flip → pattern-puzzle)
- **`lint.yml`**: ESLint + `cargo clippy -- -D warnings` on all PRs

## Testing

**Contracts:** Tests live in `src/lib.rs` under `#[cfg(test)] mod test`, using `soroban-sdk` testutils. The pattern-puzzle contract also uses snapshot tests in `test_snapshots/`.

**Backend:** Jest with Supertest. Test directories: `tests/unit/` and `tests/integration/`. Currently mostly placeholder stubs.

## Deployment Scripts

The `scripts/` directory contains: `deploy-contracts.sh`, `generate-keys.js`, `seed-database.js`, `setup-testnet.sh`.
