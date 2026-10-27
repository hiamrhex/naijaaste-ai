# Quick Start Guide

This guide helps you get up and running with NaijaTaste AI quickly.

## Installation Steps

### 1. Clone the repository
```bash
git clone https://github.com/hiamrhex/naijaaste-ai.git
cd naijaaste-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Initialize database
```bash
npm run init-db
```
This creates the necessary database tables using pg-mem for development.

### 4. Configure environment
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
- Set `DATABASE_URL` to use PostgreSQL (empty = pg-mem)
- Set `GEMINI_API_KEY` for AI features
- Set `SMTP_*` for email functionality
- Set `CORS_ORIGIN` for production (use specific origins)

### 5. Start development
```bash
npm run dev
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full development server (frontend + backend) |
| `npm run dev:server` | Start backend only with watch mode |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm test` | Run full test suite |
| `npm run test:sw` | Run service worker tests |
| `npm run test:all` | Run full test suite (build + tests + sw) |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run database migrations |
| `npm run cleanup` | Clean up development artifacts |
| `npm run verify-build` | Verify production build |
| `npm run generate-migration` | Generate new database migration |

## Troubleshooting

### Port already in use
If ports 3000 or 5173 are already in use:
```bash
# Change ports in .env
PORT=3001
VITE_PORT=5174

# Or kill existing processes
lsof -ti:5173 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Database connection errors
- Ensure DATABASE_URL is correct or leave it empty for pg-mem
- Run migrations: `npm run db:migrate`
- Clear cache: `rm -rf node_modules/.vite`

### Build errors
```bash
# Clear cache and rebuild
rm -rf dist node_modules/.vite
npm run build
```

## Environment Variables

See [`.env.example`](.env.example) for all available environment variables.

### Critical Variables
- `DATABASE_URL`: PostgreSQL connection URL (empty = pg-mem)
- `GEMINI_API_KEY`: Gemini API key (required for AI features)
- `CORS_ORIGIN`: Allowed origins (required in production)

### Optional Variables
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Email configuration
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: JWT token secrets
- `RATE_LIMIT_API_MAX`, `RATE_LIMIT_LLM_MAX`: Rate limiting values
- `NODE_ENV`: Environment (development/production)

## Next Steps

1. **Explore the app**: Open http://localhost:5173
2. **Read the docs**: Check `docs/` folder for architecture and standards
3. **Run tests**: `npm test` to verify everything works
4. **Contribute**: See `CONTRIBUTING.md` for guidelines

## Need Help?

- Check [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for detailed setup instructions
- Run `npm run verify-build` to check your setup
- Check logs in terminal for specific error messages
- Open an issue on GitHub if you encounter problems