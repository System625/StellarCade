# Stellarcade Frontend

## 🚀 Overview

The Stellarcade Frontend is a high-performance React application built with Vite, providing a modern and responsive user interface for the Stellarcade platform.

## 🛠 Tech Stack

- **Framework**: Vite + React 18
- **Language**: TypeScript
- **Styling**: Vanilla CSS (Premium Aesthetics)
- **State Management**: Zustand
- **Wallet Integration**: Stellar Freighter & Stellar SDK
- **Testing**: Vitest + Testing Library

## 📂 Folder Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── services/       # API clients and utilities
│   ├── hooks/          # Custom React hooks
│   ├── stores/         # Zustand state stores
│   ├── utils/          # Helper functions
│   └── styles/         # Global styles
├── tests/             # Test suites
├── .env.example       # Environment template
├── index.html         # HTML entry point
└── package.json
```

## 🚦 Getting Started

### Prerequisites

- Node.js v18+
- pnpm (recommended) or npm
- Backend API running (see [Backend README](../backend/README.md))

### Installation

1. **Install pnpm (if not already installed):**

   ```bash
   npm install -g pnpm
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your local settings:

   ```bash
   # Stellar Network Configuration
   VITE_STELLAR_NETWORK=testnet
   VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
   VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

   # Contract IDs (update after deploying contracts)
   VITE_PRIZE_POOL_CONTRACT_ID=C...
   VITE_ACHIEVEMENT_BADGE_CONTRACT_ID=C...
   VITE_ACCESS_CONTROL_CONTRACT_ID=C...
   VITE_COIN_FLIP_CONTRACT_ID=C...
   VITE_RANDOM_GENERATOR_CONTRACT_ID=C...
   ```

4. **Start the development server:**

   ```bash
   pnpm run dev
   ```

   The application will be available at `http://localhost:5173`.

## 🧪 Testing

Run all tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm run test:watch
```

Run tests with coverage:

```bash
pnpm run test:coverage
```

## 🔧 Development Commands

```bash
# Start development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Run type checking
pnpm run type-check

# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage

# Lint code
pnpm run lint
```

## 🎨 Features

### Current Features

- Modern React 18 with TypeScript
- Fast development with Vite HMR
- State management with Zustand
- Stellar wallet integration
- Responsive design

### Planned Features

- Dashboard with real-time balance tracking
- Interactive game interfaces (Coin Flip, Dice, etc.)
- Transparent game history and verification tools
- Prize pool leaderboards
- Tournament system UI
- NFT reward displays

## 📡 API Integration

The frontend connects to the backend API. Configure the API base URL:

```bash
# In .env (optional, defaults to http://localhost:3000)
VITE_API_URL=http://localhost:3000
```

### Making API Calls

```typescript
import { apiClient } from "@/services/api";

// Example: Fetch games
const games = await apiClient.get("/api/v1/games");
```

## 💼 Wallet Integration

Stellarcade supports Stellar wallet connections:

### Supported Wallets

- **Freighter** (browser extension)
- Other Stellar wallets via Wallets-JS

### Connecting a Wallet

```typescript
import { connectWallet } from "@/services/wallet";

const wallet = await connectWallet();
console.log(wallet.address); // User's Stellar address
```

## ✅ Verification Checklist

After setup, verify the frontend is working:

- [ ] All dependencies installed successfully
- [ ] Development server starts without errors
- [ ] Application loads in browser at `http://localhost:5173`
- [ ] Can connect to backend API (check browser console)
- [ ] Type checking passes: `pnpm run type-check`
- [ ] All tests pass: `pnpm test`

## 🐛 Troubleshooting

### Dependencies Won't Install

**Error:** `ERR_PNPM_...` or peer dependency conflicts

**Solutions:**

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm store prune
pnpm install
```

### Development Server Won't Start

**Error:** `Port 5173 is already in use`

**Solutions:**

```bash
# Find process using port 5173
lsof -i :5173

# Kill the process
kill -9 <PID>

# Or use a different port
pnpm run dev --port 3001
```

### API Connection Errors

**Error:** Network errors or CORS issues

**Solutions:**

1. Verify backend is running:

   ```bash
   curl http://localhost:3000/api/health
   ```

2. Check API URL in `.env` matches your backend:

   ```bash
   VITE_API_URL=http://localhost:3000
   ```

3. Ensure backend has CORS enabled for frontend origin

### TypeScript Errors

**Error:** Type errors during build or type-check

**Solutions:**

```bash
# Run type checking to see all errors
pnpm run type-check

# Fix errors in reported files
# Common issues: missing types, interface mismatches
```

### Wallet Connection Issues

**Error:** Wallet not detected or connection fails

**Solutions:**

1. Ensure Freighter extension is installed and unlocked
2. Verify network configuration matches backend (testnet/mainnet)
3. Check browser console for detailed error messages

## 📦 Build for Production

```bash
# Build optimized production bundle
pnpm run build

# Preview production build locally
pnpm run preview
```

Build artifacts will be in the `dist/` directory.

## 📚 Related Documentation

- [Complete Setup Guide](../docs/SETUP.md) - End-to-end local development setup
- [Backend API](../backend/README.md) - Backend server documentation
- [API Reference](../docs/API_DOCUMENTATION.md) - REST API documentation
- [Architecture](../docs/ARCHITECTURE.md) - System design overview

## 🗺 Roadmap

- **Alpha**: ✅ Static UI mockups and component library
- **Beta**: 🔄 Backend API integration (in progress)
- **Public**: ⏳ Mainnet release

---

_Stay tuned for updates! Built with ❤️ for the Stellarcade community._
