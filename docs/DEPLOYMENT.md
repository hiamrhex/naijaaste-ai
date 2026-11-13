# Deployment Guide

This guide covers deploying NaijaTaste AI to production environments.

## Prerequisites

- Node 24 runtime
- Vercel account
- Neon Postgres account
- Google Gemini API key
- Environment variables configured

## Vercel Deployment

### 1. Import Repository
1. Go to [Vercel Dashboard](https://vercel.com)
2. Click "New Project"
3. Select the NaijaTaste AI repository
4. Use the Vite preset
5. Set build output directory to `dist/`

### 2. Environment Variables
Configure these environment variables in the Vercel project:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | LLM authentication |
| `JWT_ACCESS_SECRET` | Yes | Access token signing |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing |
| `CORS_ORIGIN` | Yes | Frontend origin |
| `DATABASE_URL` | Yes | Postgres connection |

### 3. Configuration
The `vercel.json` file is pre-configured with:
- `/` → landing page (static)
- `/app/*` → SPA
- `/api/*` → serverless function (60s timeout)

### 4. Post-Deployment Verification
After deployment, verify:

```bash
curl https://your-domain.vercel.app/health
# Should return 200 with endpoint inventory

curl https://your-domain.vercel.app/app/login
# Should return 200

# Test signup flow
curl -X POST https://your-domain.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test!1234"}'
```

## Neon Database Setup

### 1. Create Database
1. Go to [Neon Dashboard](https://neon.tech)
2. Create a new project
3. Note the database URL

### 2. Run Migrations
```bash
# Set DATABASE_URL_DIRECT to the direct Neon URL
export DATABASE_URL_DIRECT="postgresql://user:password@host:port/database"

# Run migrations
npm run db:migrate
```

### 3. Verify Schema
Check that all tables are created:
- `schema_migrations`
- `users`
- `sessions`
- `restaurants`
- `otp`
- `ratings`
- `reports`
- `llm_quota`
- `auth_attempts`
- `refresh_tokens`
- `favorites`
- `saved_places`

## Environment Configuration

### Production Environment Variables
```bash
# Required for production boot
GEMINI_API_KEY=your_gemini_key
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
CORS_ORIGIN=https://your-domain.vercel.app
DATABASE_URL=your_neon_pooled_url

# Optional but recommended
ADMIN_EMAILS=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
GOOGLE_CLIENT_ID=your_google_client_id

# Performance tuning
LOG_LEVEL=info
RATE_LIMIT_API_MAX=600
RATE_LIMIT_LLM_MAX=10
```

## Monitoring & Health Checks

### Health Endpoints
- `GET /health` - Returns API inventory and status
- `GET /health/ready` - Database connectivity check
- `GET /metrics` - Prometheus-format metrics (requires a bearer token)

`vercel.json` rewrites these unversioned paths to the serverless function; a
new endpoint advertised on `/health` needs a matching rewrite or it answers
404 in production (`tests/deployment-config.test.js` enforces this).

### Uptime Monitoring
Configure monitoring on:
- `https://your-domain.vercel.app/health`
- `https://your-domain.vercel.app/health/ready`

### Error Tracking
Set `SENTRY_DSN` in Vercel environment to enable error tracking.

## Troubleshooting

### Common Issues

#### 1. Function Invocation Failed
**Cause**: Missing environment variables
**Solution**: Ensure all 5 required env vars are set in Vercel

#### 2. CORS Errors
**Cause**: Missing or incorrect `CORS_ORIGIN`
**Solution**: Set to your frontend domain

#### 3. Database Connection Issues
**Cause**: Incorrect `DATABASE_URL`
**Solution**: Verify Neon connection string

#### 4. LLM Failures
**Cause**: Invalid `GEMINI_API_KEY`
**Solution**: Verify API key and billing status

### Log Analysis
Check Vercel logs for:
- Function execution times
- Error rates
- Database query performance
- LLM response times

## Performance Optimization

### Vercel Settings
- Increase function timeout if needed (default: 60s)
- Enable edge caching for static assets
- Configure headers for security

### Database Optimization
- Monitor query performance
- Use connection pooling
- Consider read replicas for scale

### Asset Optimization
- Images are optimized automatically by Vercel
- Service worker for offline functionality
- PWA manifest configured

## Backup & Recovery

### Database Backups
Neon provides:
- Automated backups
- Point-in-time recovery
- Manual export option

### Application Backups
- Source code is backed up via GitHub
- Environment variables need to be reconfigured if lost

### Disaster Recovery
1. Restore database from Neon dashboard
2. Re-deploy to Vercel
3. Reconfigure environment variables
4. Verify functionality

## Scaling Considerations

### Current Limits
- Vercel: 300s timeout, 4.5MB memory
- Neon: Free tier has usage limits
- Gemini: Rate limits on API calls

### Scaling Options
- Upgrade Vercel plan for more resources
- Use Neon Pro for higher limits
- Implement caching for frequently accessed data
- Consider CDN for static assets

## Security Considerations

### Production Hardening
- All environment variables are required
- CORS is fail-closed
- Rate limiting is enabled
- JWT tokens are properly configured
- Database access is properly secured

### Secret Management
- Never commit secrets to git
- Use Vercel environment variables
- Rotate secrets periodically
- Monitor for unauthorized access