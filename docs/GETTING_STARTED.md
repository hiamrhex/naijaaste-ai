# Getting Started Guide

This guide helps new developers get up and running with NaijaTaste AI quickly.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 24** (v24.12.0 or later)
- **npm** (comes with Node.js)
- **Git** for version control
- **A code editor** (VS Code recommended)

## Quick Setup (5 minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/hiamrhex/naijaste-ai.git
cd naijataste-ai
```

### 2. Install Dependencies

```bash
npm ci  # This will install exact versions from package-lock.json
```

### 3. Set Up Environment

```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file to add required credentials
# At minimum, you need:
# GEMINI_API_KEY=your_gemini_api_key
# JWT_ACCESS_SECRET=your_access_secret
# JWT_REFRESH_SECRET=your_refresh_secret
# CORS_ORIGIN=http://localhost:5173
# DATABASE_URL=postgres://user:pass@host:port/db
```

### 4. Run Tests

```bash
npm test  # Runs all 93 tests
```

### 5. Start Development Servers

In two separate terminals:

```bash
# Terminal 1: API Server
npm start

# Terminal 2: Frontend Development Server
npm run dev
```

### 6. Verify Installation

```bash
# Check API health
curl http://127.0.0.1:3000/health

# Should return something like:
# {"status":"ok","endpoints":31,"version":"0.0.0","timestamp":"..."}
```

## Detailed Setup

### Environment Configuration

Required environment variables:

| Variable | Purpose | How to Get |
|----------|---------|-----------|
| `GEMINI_API_KEY` | Google AI API key | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `JWT_ACCESS_SECRET` | JWT signing secret | Generate with `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Refresh token secret | Generate with `openssl rand -base64 32` |
| `CORS_ORIGIN` | Frontend URL | For development: `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection | Use Neon for free database |

### Database Setup

For development, the app uses `pg-mem` (in-memory database) that doesn't require PostgreSQL.

For production or testing:

1. Create a Neon database account
2. Get your database URL
3. Set `DATABASE_URL_DIRECT` for migrations:

```bash
export DATABASE_URL_DIRECT="postgresql://user:password@host:port/database"
npm run db:migrate
```

### Google API Setup (Optional)

If you want to enable Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add your redirect URI: `http://localhost:5173/auth/google/callback`
6. Set `GOOGLE_CLIENT_ID` in your environment

### Email Setup (Optional)

For password reset functionality:

1. Set up an SMTP service (Gmail works with app passwords)
2. Configure these variables:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=your@gmail.com`
   - `SMTP_PASS=your_app_password`

## Project Structure

```
naijataste-ai/
├── src/                 # Source code
│   ├── server.js       # Main server file
│   ├── routes/         # API route handlers
│   ├── middleware/     # Express middleware
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── config/         # Configuration files
├── tests/              # Test files
├── docs/               # Documentation
├── public/             # Static assets
├── .env.example        # Environment template
├── package.json        # Dependencies and scripts
└── README.md           # Main project documentation
```

## Development Workflow

### Making Changes

1. Create a new branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `npm test`
4. Commit changes: `git commit -m "feat: add new feature"`
5. Push: `git push origin feature/your-feature`

### Testing

The project uses Vitest for testing:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test tests/auth.test.js

# Run tests in watch mode
npm run test:watch
```

### Linting and Formatting

```bash
# Check code style
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Common Development Tasks

### Adding New API Endpoints

1. Create route file in `src/routes/`
2. Add route handler with proper validation
3. Add tests in `tests/`
4. Update API documentation in `docs/API_ENDPOINTS.md`

### Adding New Features

1. Create component in `src/components/`
2. Add to appropriate screen in `src/screens/`
3. Add tests if needed
4. Update documentation

### Database Changes

1. Create migration file: `npm run db:migrate:create --add-table-name`
2. Write migration SQL
3. Run migration: `npm run db:migrate`
4. Update TypeScript types if applicable

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find and kill process using port 3000
netstat -ano | findstr :3000
taskkill /F /PID <process_id>
```

#### Environment Variables Not Loading

```bash
# Check .env file exists
ls -la .env

# Ensure no syntax errors in .env
# No quotes around values, no spaces around =
```

#### Tests Failing

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Skip LLM-dependent tests for faster runs
npm test -- --skipLLM
```

#### Database Connection Issues

```bash
# Check if using pg-mem (dev) or real DB
echo $DATABASE_URL

# If using Neon, verify connection string
# Format: postgres://user:password@host:port/database
```

### Getting Help

1. Check existing issues on GitHub
2. Review documentation in `docs/` folder
3. Look at test files for examples
4. Check the troubleshooting guide

## Next Steps

Once you have the project running:

1. Explore the API endpoints using the health check
2. Try the chat interface at `http://localhost:5173/app`
3. Test the authentication flow
4. Experiment with the restaurant search
5. Check out the admin panel for system monitoring

## Contributing

When contributing to the project:

1. Follow the conventional commit format
2. Ensure all tests pass
3. Update documentation as needed
4. Check for linting issues
5. Submit a pull request with a clear description

For more detailed contribution guidelines, see [CONTRIBUTING_GUIDE.md](CONTRIBUTING_GUIDE.md).