# Local Development Setup Guide

This guide walks through setting up NaijaTaste-ai for development.

## Prerequisites

- Node.js 18+ (LTS)
- npm or yarn

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/hiamrhex/naijaaste-ai.git
cd naijaaste-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Copy environment variables
```bash
cp .env.example .env
```

### 4. Configure your environment
Edit `.env` with your settings:
- Set `DATABASE_URL` for production (empty for local pg-mem)
- Set `GEMINI_API_KEY` for LLM features
- Set `SMTP_*` for email functionality
- Set `CORS_ORIGIN` for allowed origins

### 5. Start development servers

**Option A: Full development mode**
```bash
npm run dev
```
- Runs Vite dev server (frontend)
- Runs server with watch mode (backend)

**Option B: Separate servers**
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend only
npm run dev:server
```

### 6. Run tests
```bash
# Full test suite (lint + tests)
npm test

# Test with coverage
npm run test:sw

# E2E tests
npx playwright test
```

## Database Setup

The app uses two database modes:

### Local Development (no DATABASE_URL)
- Uses pg-mem for ephemeral in-memory database
- No database migration required
- Data is lost on restart
- Perfect for testing and prototyping

### Production (DATABASE_URL set)
- Uses Neon Postgres (or your preferred provider)
- Runs migrations automatically
- Persistent data across restarts

To run migrations:
```bash
npm run db:migrate
```

## Development Features

### API Endpoints
- `/app/signup` - User registration
- `/app/login` - User login
- `/app/map` - Map view with nearby restaurants
- `/app/saved` - Saved places management
- `/app/settings` - User settings and account management

### Admin Features
- `/app/admin/reports` - View and manage user reports
- `/app/admin/stats` - System statistics

### API Structure
- Frontend API calls use `/api/v1/*` prefix
- Backend responds with standard error format
- All endpoints require authentication except public ones

## Common Issues

### Port already in use
If port 5173 or 3000 is already in use:
```bash
# Change ports in `.env`
PORT=3001
VITE_PORT=5174

# Or kill the process
lsof -ti:5173 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Database connection errors
- Ensure `DATABASE_URL` is set correctly
- Check PostgreSQL is running if using real database
- Empty DATABASE_URL uses pg-mem

### Build errors
```bash
# Clear cache and rebuild
rm -rf dist node_modules/.vite
npm run build
```

## Project Structure

```
naijataste-ai/
├── src/
│   ├── api/          # API routes and handlers
│   ├── components/   # React components
│   ├── db/           # Database functions
│   ├── lib/          # Utility functions
│   ├── routes/       # Route definitions
│   └── server.js     # Main server entry
├── tests/            # Test files
├── migrations/       # Database migrations
├── docs/             # Documentation
└── public/           # Static assets
```

## Useful Commands

```bash
# Lint code
npm run lint

# Type check
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview

# Generate SQL schema
npm run db:migrate

# Run security scan
npm run scan:secrets

# Check documentation links
npm run check:docs

# E2E tests with specific browser
npx playwright test --project=desktop
npx playwright test --project=mobile
```

## Getting Help

- Check `docs/` folder for architecture and standards
- Review `tests/e2e/smoke.spec.js` for user journeys
- Open an issue on GitHub if you find bugs
- Review the CHANGELOG for recent changes

## Development Tips

1. **Feature flags**: Test features before making them default
2. **Database migrations**: Always test migrations in development first
3. **Security**: Never commit `.env` or database credentials
4. **Testing**: Write tests for new features, don't add them later
5. **Documentation**: Keep docs up to date with code changes