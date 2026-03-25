# Stellarcade Backend

## 🚀 Overview

The Stellarcade Backend is a Node.js Express application that manages game logic, user accounts, and interactions with the Stellar network. It serves as the API layer between the frontend and smart contracts.

## 🛠 Tech Stack

- **Framework**: Express.js
- **Database**: PostgreSQL (via Knex.js)
- **Cache**: Redis
- **Blockchain**: Stellar SDK
- **Logging**: Winston
- **Validation**: Express Validator
- **Testing**: Jest & Supertest

## 📂 Folder Structure

```
backend/
├── src/
│   ├── config/         # Configuration (DB, Redis, Stellar, Logger)
│   ├── controllers/    # Route handlers
│   ├── services/       # Business logic and blockchain interactions
│   ├── models/         # Database models
│   ├── routes/         # API endpoint definitions
│   └── middleware/     # Auth, error handling, validation
├── migrations/         # Knex database migrations
├── tests/             # Test suites
├── .env.example       # Environment template
└── package.json
```

## 🚦 Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL (via Docker or local installation)
- Redis (via Docker or local installation)

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your local settings. Key variables:

   ```bash
   # Database (PostgreSQL)
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/stellarcade

   # Redis
   REDIS_URL=redis://localhost:6379

   # Stellar Network
   STELLAR_NETWORK=testnet
   HORIZON_URL=https://horizon-testnet.stellar.org
   NETWORK_PASSPHRASE=Test SDF Network ; September 2015

   # Contract IDs (update after deploying contracts)
   PRIZE_POOL_CONTRACT_ID=C...
   RNG_CONTRACT_ID=C...
   COIN_FLIP_CONTRACT_ID=C...

   # Auth
   JWT_SECRET=your_super_secret_jwt_key_change_me
   ```

3. **Start infrastructure services:**

   **Option A: Using Docker (Recommended)**

   From the project root:

   ```bash
   docker-compose up -d
   ```

   This starts PostgreSQL and Redis automatically.

   **Option B: Local installation**

   Ensure PostgreSQL and Redis are running locally on their default ports (5432 and 6379).

4. **Run database migrations:**

   ```bash
   npm run migrate
   ```

5. **Seed the database (optional):**

   Populate your local database with sample data for testing:

   ```bash
   npm run seed
   ```

6. **Start the development server:**

   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000`.

## 🧪 Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## 📡 API Endpoints

### Health Check

```bash
curl http://localhost:3000/api/health
```

### Versioning

The API supports versioning via URL path or header:

- **Path**: `/api/v1/games`
- **Header**: `X-API-Version: v1`

If no version is specified, the API defaults to `v1`.

See [API Documentation](../docs/API_DOCUMENTATION.md) for complete endpoint reference.

## 🐳 Docker

Run the backend in Docker:

```bash
# From project root
docker-compose up backend

# View logs
docker-compose logs -f backend
```

## 🔧 Development Commands

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Run database migrations
npm run migrate

# Seed database with sample data
npm run seed

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## ✅ Verification Checklist

After setup, verify the backend is working:

- [ ] Server starts without errors
- [ ] Health endpoint responds: `curl http://localhost:3000/api/health`
- [ ] Database migrations completed successfully
- [ ] Can connect to PostgreSQL
- [ ] Can connect to Redis
- [ ] All tests pass: `npm test`

## 🔍 Troubleshooting

### Database Connection Errors

**Error:** `ECONNREFUSED` or connection timeout

**Solutions:**

1. Verify PostgreSQL is running:

   ```bash
   docker ps | grep postgres
   # or check local service
   ```

2. Check connection string in `.env` matches your setup:

   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/stellarcade
   ```

3. Test connection directly:
   ```bash
   # If using Docker
   docker-compose exec db psql -U postgres -d stellarcade -c "SELECT 1;"
   ```

### Redis Connection Errors

**Error:** `Redis connection failed`

**Solutions:**

1. Verify Redis is running:

   ```bash
   docker ps | grep redis
   ```

2. Test Redis connection:
   ```bash
   docker-compose exec redis redis-cli ping
   # Should return: PONG
   ```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solutions:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Stellar Network Errors

**Error:** Horizon API timeouts or network errors

**Solutions:**

1. Verify network configuration in `.env`:

   ```bash
   STELLAR_NETWORK=testnet
   HORIZON_URL=https://horizon-testnet.stellar.org
   ```

2. Test Horizon API:

   ```bash
   curl https://horizon-testnet.stellar.org/
   ```

3. Ensure you have test XLM for the configured account:
   - Get test XLM: https://laboratory.stellar.org/#account-creator?network=test

## 📚 Related Documentation

- [Complete Setup Guide](../docs/SETUP.md) - End-to-end local development setup
- [API Reference](../docs/API_DOCUMENTATION.md) - Detailed API documentation
- [Architecture](../docs/ARCHITECTURE.md) - System design overview
- [Security](../docs/SECURITY.md) - Security guidelines

---

_Built with ❤️ for the Stellarcade community._
