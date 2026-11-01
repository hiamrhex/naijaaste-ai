# Troubleshooting Guide

This guide helps diagnose and fix common issues with NaijaTaste AI.

## Quick Reference

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| `EADDRINUSE :::3000` | Zombie node process | `taskkill /F /PID <id>` |
| Signup shows "Request failed" | CORS or API not running | Check `CORS_ORIGIN`, run API |
| `FUNCTION_INVOCATION_FAILED` | Missing env vars | Set all 5 required vars |
| `dev_otp` missing | `DEV_OTP_ENABLED` not true | Set locally only |
| `= ANY($1)` returns [] | pg-mem array gap | Use dynamic `IN (...)` |
| OSM import `OSM_FETCH_FAILED` | Network issues | Mirrors retry, daily cron |
| Test timeouts | pg-mem + bcrypt | Increase `hookTimeout` |
| PowerShell `$env:X=''` deletes var | PS 5.1 semantics | Use `Remove-Item Env:X` |

## Development Issues

### Environment Setup

#### Node.js Version Issues
**Problem**: Version conflicts or missing Node 24
```bash
# Check Node version
node --version  # Should be 24.x.x

# Use nvm to manage versions
nvm install 24
nvm use 24
```

#### Missing Dependencies
**Problem**: `npm ci` fails or missing packages
```bash
# Clean install
rm -rf node_modules package-lock.json
npm ci

# Check for missing packages
npm audit
```

#### Environment Variable Issues
**Problem**: Boot fails due to missing required vars
```bash
# Copy example env file
cp .env.example .env

# Set required variables
# GEMINI_API_KEY=your_key_here
# JWT_ACCESS_SECRET=access_secret_here
# JWT_REFRESH_SECRET=refresh_secret_here
# CORS_ORIGIN=http://localhost:5173
# DATABASE_URL=postgres://user:pass@host:port/db
```

### Development Server Issues

#### API Server Won't Start
**Problem**: Port 3000 is in use
```bash
# Find and kill process using port 3000
netstat -ano | findstr :3000
taskkill /F /PID <process_id>

# Or use different port
PORT=3001 npm start
```

#### Frontend Won't Load
**Problem**: CORS issues or API not running
```bash
# Start API server in one terminal
npm start

# Start frontend in another terminal
npm run dev
```

#### Test Failures
**Problem**: Tests failing due to LLM timeouts or environment issues
```bash
# Run tests without LLM calls
npm test -- --reporter=verbose

# Skip LLM-dependent tests
npm test -- --skipLLM

# Run specific test file
npm test -- tests/auth.test.js
```

## Production Issues

### Vercel Deployment Issues

#### Function Invocation Failed
**Problem**: API function fails to deploy
```bash
# Check environment variables in Vercel dashboard
# Ensure all 5 required vars are set:
# - GEMINI_API_KEY
# - JWT_ACCESS_SECRET
# - JWT_REFRESH_SECRET
# - CORS_ORIGIN
# - DATABASE_URL

# Check Vercel logs for specific error messages
```

#### CORS Errors
**Problem**: Frontend can't connect to API
```bash
# Set correct CORS_ORIGIN in Vercel
# Should match your frontend domain
# Development: http://localhost:5173
# Production: https://your-domain.vercel.app
```

#### Database Connection Issues
**Problem**: Can't connect to Neon database
```bash
# Verify DATABASE_URL in Vercel
# Should be the pooled URL from Neon

# Test connection directly
npm run db:migrate
# Requires DATABASE_URL_DIRECT to be set
```

### API Issues

#### Authentication Problems
**Problem**: Users can't sign up or sign in
```bash
# Check JWT secrets are set
# Verify bcrypt is working (cost 12)

# Test auth endpoints directly
curl -X POST https://your-domain.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"Test!1234"}'
```

#### LLM Service Issues
**Problem**: AI responses fail or timeout
```bash
# Check GEMINI_API_KEY is valid
# Verify billing is active in Google AI Studio

# Check rate limits
# LLM endpoints have 10/min limit per client

# Test fallback behavior
# System should work with deterministic fallback
```

#### Rate Limiting Issues
**Problem**: Getting 429 errors
```bash
# Check rate limit headers
# Retry-After indicates when to retry

# Adjust limits in code if needed
# RATE_LIMIT_API_MAX=600 (default)
# RATE_LIMIT_LLM_MAX=10 (default)
```

## Performance Issues

### Slow Response Times
**Problem**: API responses are slow
```bash
# Check database queries
# Look for slow queries in logs

# Monitor LLM response times
# Gemini calls can be slow (2-5s)

# Check Vercel function timeouts
# Default is 60s, may need increase
```

### High Memory Usage
**Problem**: Function using too much memory
```bash
# Check Vercel memory limits
# Default: 1024MB

# Optimize database queries
# Use indexes properly

# Monitor LLM token usage
# Large responses use more memory
```

## Data Issues

### Restaurant Data Problems
**Problem**: Missing or incorrect restaurant data
```bash
# Check OSM import status
# Daily cron should refresh data

# Verify data quality
# Check for duplicates, missing fields

# Manual refresh trigger
# GitHub Actions workflow available
```

### User Data Issues
**Problem**: User sessions or favorites lost
```bash
# Check database connectivity
# Verify tables exist and have data

# Check JWT token handling
# Verify refresh token rotation works

# Check session ownership
# Sessions should be user-scoped
```

## Error Analysis

### Common Error Codes

#### 400 VALIDATION_ERROR
**Cause**: Invalid request format
**Solution**: Check request body matches schema

#### 401 INVALID_CREDENTIALS
**Cause**: Wrong email or password
**Solution**: Verify credentials, check account exists

#### 403 FORBIDDEN
**Cause**: Insufficient permissions
**Solution**: Check user role and endpoint requirements

#### 404 NOT_FOUND
**Cause**: Resource doesn't exist
**Solution**: Check resource ID and ownership

#### 413 PAYLOAD_TOO_LARGE
**Cause**: Request body too large
**Solution**: Reduce request size

#### 429 RATE_LIMITED
**Cause**: Too many requests
**Solution**: Wait for Retry-After, reduce frequency

#### 502 UPSTREAM_FAILURE
**Cause**: LLM service unavailable
**Solution**: System should use fallback, check Gemini status

#### 503 SERVICE_UNAVAILABLE
**Cause**: Database or service down
**Solution**: Check service health, wait for recovery

### Log Analysis

#### Error Log Patterns
```bash
# Check for repeated errors
grep "ERROR" logs/*.log | sort | uniq -c

# Check for timeout patterns
grep "timeout" logs/*.log

# Check for database errors
grep "database" logs/*.log
```

#### Performance Metrics
```bash
# Check response times
grep "response_time" logs/*.log | sort -n

# Check error rates
grep "ERROR" logs/*.log | wc -l

# Check LLM success rates
grep "LLM_SUCCESS" logs/*.log | wc -l
```

## Debugging Tools

### Local Development
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Test API directly
curl -v http://localhost:3000/health

# Check database state
npm run db:migrate -- --dry-run
```

### Production Debugging
```bash
# Check Vercel logs
# Dashboard > Functions > Logs

# Check health endpoints
curl https://your-domain.vercel.app/health

# Check database connectivity
curl https://your-domain.vercel.app/health/ready
```

### Testing Tools
```bash
# Run specific test scenarios
npm test -- tests/auth.test.js

# Test error conditions
npm test -- tests/errors.test.js

# Performance testing
npm run evaluate
```

## Recovery Procedures

### Database Recovery
```bash
# Neon restore from dashboard
# 1. Go to Neon dashboard
# 2. Select database
# 3. Use point-in-time restore
# 4. Update DATABASE_URL in Vercel

# Manual restore
# Use pg_dump and pg_restore
```

### Code Recovery
```bash
# Rollback to previous commit
git checkout <commit_hash>

# Re-deploy to Vercel
git push origin master

# Verify functionality
curl https://your-domain.vercel.app/health
```

### Data Recovery
```bash
# Check backup data
# OSM data is refreshed daily
# User data is in database

# Manual data import
# Use scripts/import-osm.js for fresh data
```

## Prevention

### Monitoring Setup
- Configure uptime monitoring on `/health`
- Set up error tracking with Sentry
- Monitor database performance
- Track LLM success rates

### Regular Maintenance
- Update dependencies regularly
- Monitor Vercel logs for issues
- Check database performance
- Verify data quality

### Documentation Updates
- Keep README and API docs current
- Update troubleshooting guides
- Document new issues and solutions
- Maintain deployment guides