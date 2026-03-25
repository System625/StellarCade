# Local Development Setup Guide

This guide provides a complete step-by-step workflow for setting up Stellarcade for local development. Follow these steps in order to get all subsystems (contracts, backend, frontend) running on a fresh clone.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

| Tool            | Version       | Install Link                                                       |
| --------------- | ------------- | ------------------------------------------------------------------ |
| **Rust**        | Latest stable | [Install Rust](https://www.rust-lang.org/tools/install)            |
| **Stellar CLI** | Latest        | `cargo install --locked stellar-cli` or `brew install stellar-cli` |
| **Node.js**     | v18+          | [Install Node.js](https://nodejs.org/)                             |
| **Docker**      | Latest        | [Install Docker](https://www.docker.com/products/docker-desktop)   |
| **Git**         | Latest        | [Install Git](https://git-scm.com/)                                |

### Verify Prerequisites

```bash
# Check Rust installation
rustc --version

# Check Stellar CLI
stellar --version

# Check Node.js
node --version  # Should be v18+
npm --version

# Check Docker
docker --version
docker compose version
```

## 🚀 Quick Start (Docker-Based)

For the fastest setup, use Docker Compose to run the backend and databases:

```bash
# From the project root
git clone https://github.com/stellar/stellarcade.git
cd stellarcade

# Enable Git hooks (mirrors CI checks locally)
git config core.hooksPath .githooks

# Start all services (PostgreSQL, Redis, Backend)
docker-compose up -d

# Verify services are running
docker ps
```

## 📂 Complete Setup Workflow

### Step 1: Clone and Initialize

```bash
git clone https://github.com/stellar/stellarcade.git
cd stellarcade

# Enable Git hooks for pre-commit formatting and pre-push validation
git config core.hooksPath .githooks
```

### Step 2: Set Up Smart Contracts

Contracts must be built first as other subsystems depend on deployed contract IDs.

```bash
cd contracts

# Build all contracts (produces WASM files)
soroban contract build

# Run contract tests to verify everything works
cargo test

# Optional: Build a specific contract (e.g., prize-pool)
cd prize-pool
cargo build --target wasm32-unknown-unknown --release
```

**Verification:** You should see WASM files in `target/wasm32-unknown-unknown/release/` for each contract.

> **Note:** For local development, you'll need to deploy contracts to a testnet or local network. See [Contract Deployment Guide](docs/contracts/DEPLOYMENT.md) for deployment steps.

### Step 3: Set Up Backend

```bash
cd ../backend

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env

# Edit .env with your settings (at minimum, update contract IDs after deployment)
# Required variables:
# - DATABASE_URL (default: postgres://postgres:postgres@localhost:5432/stellarcade)
# - REDIS_URL (default: redis://localhost:6379)
# - STELLAR_NETWORK (default: testnet)
# - Contract IDs (PRIZE_POOL_CONTRACT_ID, RNG_CONTRACT_ID, etc.)
```

**Run database migrations:**

```bash
# If using Docker Compose, the database is already running
npm run migrate
```

**Seed the database (optional but recommended for testing):**

```bash
npm run seed
```

**Start the backend:**

```bash
# Development mode with hot reload
npm run dev

# Or run in production mode
npm start
```

**Verification:** Backend should be running at `http://localhost:3000`. Test with:

```bash
curl http://localhost:3000/api/health
```

### Step 4: Set Up Frontend

```bash
cd ../frontend

# Install dependencies (frontend uses pnpm)
pnpm install

# Copy environment template
cp .env.example .env

# Update contract IDs in .env to match your deployed contracts
# VITE_PRIZE_POOL_CONTRACT_ID=C...
# VITE_COIN_FLIP_CONTRACT_ID=C...
# etc.
```

**Start the development server:**

```bash
pnpm run dev
```

**Verification:** Frontend should be running at `http://localhost:5173` (Vite default). Open in your browser to verify the UI loads.

## 🔗 Startup Order

Always start services in this order:

1. **Docker services** (Database + Redis) → `docker-compose up -d`
2. **Backend API** → `cd backend && npm run dev`
3. **Frontend** → `cd frontend && pnpm run dev`

### Quick Start Script

Create a convenience script at the project root:

```bash
#!/bin/bash
# scripts/start-local.sh

echo "🚀 Starting Stellarcade local development environment..."

# Start infrastructure
echo "📦 Starting Docker services (PostgreSQL, Redis)..."
docker-compose up -d

# Wait for services to be ready
sleep 5

# Start backend
echo "🔧 Starting backend..."
cd backend && npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to initialize
sleep 3

# Start frontend
echo "🎨 Starting frontend..."
cd frontend && pnpm run dev &
FRONTEND_PID=$!

echo "✅ All services started!"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "📍 Access points:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:3000"
echo "   PostgreSQL: localhost:5432"
echo "   Redis: localhost:6379"
echo ""
echo "Press Ctrl+C to stop all services"

wait
```

Make it executable:

```bash
chmod +x scripts/start-local.sh
```

## ✅ Verification Checklist

After setup, verify each subsystem:

### Contracts

- [ ] All contracts build without errors (`soroban contract build`)
- [ ] All tests pass (`cargo test`)
- [ ] WASM artifacts exist in target directory

### Backend

- [ ] Docker containers are running (`docker ps`)
- [ ] Database migrations completed successfully
- [ ] Backend responds to health check: `curl http://localhost:3000/api/health`
- [ ] Can connect to PostgreSQL and Redis

### Frontend

- [ ] All dependencies installed (`pnpm install`)
- [ ] Development server starts without errors
- [ ] UI loads in browser at `http://localhost:5173`
- [ ] Can connect to backend API

### End-to-End

- [ ] Frontend can call backend API
- [ ] Backend can read/write to database
- [ ] Backend can connect to Redis for caching
- [ ] Stellar network connection works (check logs for Horizon API calls)

## 🔧 Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Check what's using the port
lsof -i :3000  # or :5432, :6379, :5173

# Kill the process if needed
kill -9 <PID>
```

**Docker containers won't start:**

```bash
# Check Docker daemon is running
docker ps

# Restart Docker Desktop or daemon
# On macOS: Restart Docker Desktop app
# On Linux: sudo systemctl restart docker

# Clean up stale containers
docker-compose down -v
docker-compose up -d
```

**Database connection errors:**

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check connection string in .env matches docker-compose.yml
# Default: postgres://postgres:postgres@localhost:5432/stellarcade

# Test connection directly
docker-compose exec db psql -U postgres -d stellarcade -c "SELECT 1;"
```

**Contract build fails:**

```bash
# Update Rust toolchain
rustup update

# Ensure wasm32 target is installed
rustup target add wasm32-unknown-unknown

# Clean and rebuild
cd contracts
cargo clean
soroban contract build
```

**Frontend won't start:**

```bash
# Clear node modules and reinstall
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run dev
```

**Stellar network errors:**

```bash
# Verify you're using the correct network
# Check .env files for STELLAR_NETWORK and HORIZON_URL

# For testnet, ensure you have test XLM
# Get test XLM: https://laboratory.stellar.org/#account-creator?network=test

# Check Horizon API is accessible
curl https://horizon-testnet.stellar.org/
```

## 🧹 Cleanup

To stop all services and clean up:

```bash
# Stop Docker services
docker-compose down

# Stop backend and frontend (if running in foreground, press Ctrl+C)

# Optional: Remove all Docker volumes (deletes database data)
docker-compose down -v

# Optional: Clean contract build artifacts
cd contracts && cargo clean
```

## 📚 Next Steps

- [Architecture Overview](ARCHITECTURE.md) - Understand system design
- [API Documentation](API_DOCUMENTATION.md) - Explore available endpoints
- [Game Rules](GAME_RULES.md) - Learn about game mechanics
- [Contributing Guide](../CONTRIBUTING.md) - Start contributing
- [Contract Deployment](docs/contracts/DEPLOYMENT.md) - Deploy contracts to testnet

## 🆘 Getting Help

- Check existing issues on [GitHub](https://github.com/stellar/stellarcade/issues)
- Review [Security Guidelines](SECURITY.md) for security concerns
- Join the community on [Discord](#) (placeholder)
