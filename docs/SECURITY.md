# Security Guide

This document outlines the security measures and best practices for NaijaTaste AI.

## Security Overview

NaijaTaste AI implements multiple layers of security to protect user data and ensure system integrity:

- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: Protection against brute force attacks
- **Data Protection**: Secure storage and transmission
- **Error Handling**: Secure error messages

## Authentication & Authorization

### JWT Authentication

The application uses JSON Web Tokens (JWT) for authentication:

```javascript
// Token generation
const accessToken = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: '15m' }
);

const refreshToken = jwt.sign(
  { userId: user.id },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);
```

### Token Validation

```javascript
// JWT middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  }
  
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }
    req.user = user;
    next();
  });
}
```

### Role-Based Access Control

```javascript
// Admin authorization
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  }
  next();
}
```

## Input Validation

### Request Validation

The application uses Zod for schema validation:

```javascript
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
});

// Validation middleware
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR',
          details: result.error.errors 
        } 
      });
    }
    next();
  };
}
```

### SQL Injection Prevention

```javascript
// Parameterized queries
async function getUserByEmail(email) {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  return result.rows[0];
}

// Never use string concatenation for queries
// BAD: const query = `SELECT * FROM users WHERE email = '${email}'`;
```

## Rate Limiting

### API Rate Limiting

```javascript
// Rate limiting configuration
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per window
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 API requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
```

### LLM Rate Limiting

```javascript
// LLM endpoint rate limiting
const llmLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 LLM requests per window
  keyGenerator: (req) => {
    // Rate limit by user ID when authenticated
    return req.user ? req.user.userId : req.ip;
  },
});
```

## Data Protection

### Password Security

```javascript
// Password hashing with bcrypt
const bcrypt = require('bcrypt');

async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
```

### Secure Headers

```javascript
// Security headers middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### CORS Configuration

```javascript
// CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

## Error Handling

### Secure Error Messages

```javascript
// Error handling middleware
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  
  // Don't expose internal errors to client
  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({ 
      error: { 
        code: 'EMAIL_TAKEN',
        message: 'Email already registered'
      } 
    });
  }
  
  // Generic error for all other cases
  res.status(500).json({ 
    error: { 
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    } 
  });
}
```

### Request ID Tracking

```javascript
// Request ID middleware
function requestId(req, res, next) {
  const id = crypto.randomUUID();
  req.id = id;
  res.set('X-Request-ID', id);
  next();
}
```

## Database Security

### Connection Security

```javascript
// SSL connection for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});
```

### Query Security

```javascript
// Always use parameterized queries
async function createUser(user) {
  const query = `
    INSERT INTO users (email, name, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, email, name, role
  `;
  
  const values = [
    user.email,
    user.name,
    user.passwordHash,
    user.role || 'user'
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}
```

## API Security

### Authentication Endpoints

```javascript
// Secure signup endpoint
app.post('/auth/signup', authLimiter, validate(signupSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if email already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ 
        error: { code: 'EMAIL_TAKEN' } 
      });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const user = await createUser({ email, passwordHash, name });
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      ...tokens
    });
  } catch (error) {
    next(error);
  }
});
```

### Protected Endpoints

```javascript
// Protected endpoint example
app.get('/auth/me', authenticateToken, async (req, res) => {
  const user = await getUserById(req.user.userId);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
});
```

## Data Privacy

### User Data Protection

```javascript
// Sanitize user data
function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

// Never return sensitive data
function badExample(user) {
  return {
    ...user,
    passwordHash: user.password_hash, // Never do this!
    refreshToken: user.refresh_token // Never do this!
  };
}
```

### Data Encryption

```javascript
// Encrypt sensitive data
const crypto = require('crypto');

function encrypt(text, secret) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(secret, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return { encrypted, iv: iv.toString('hex') };
}
```

## Security Monitoring

### Security Logging

```javascript
// Security event logging
function logSecurityEvent(event, details) {
  console.log({
    timestamp: new Date().toISOString(),
    event,
    details,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
}

// Example: Failed login attempt
app.post('/auth/signin', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    
    if (!user || !await verifyPassword(password, user.password_hash)) {
      logSecurityEvent('FAILED_LOGIN', { email, ip: req.ip });
      return res.status(401).json({ 
        error: { code: 'INVALID_CREDENTIALS' } 
      });
    }
    
    // Success case
    logSecurityEvent('SUCCESS_LOGIN', { userId: user.id, email });
    // ... rest of login logic
  } catch (error) {
    next(error);
  }
});
```

### Security Metrics

Track these security metrics:

- Failed login attempts
- Rate limit triggers
- SQL injection attempts
- XSS attempts
- CSRF attempts
- Data access patterns

## Security Testing

### Penetration Testing

```bash
# Install OWASP ZAP for security testing
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:5173

# Run security tests with npm
npm run test:security
```

### Dependency Scanning

```bash
# Check for vulnerable dependencies
npm audit

# Generate security report
npm audit --json > security-report.json
```

## Security Configuration

### Environment Variables

Required security environment variables:

| Variable | Purpose | Security Level |
|----------|---------|----------------|
| `JWT_ACCESS_SECRET` | JWT access token signing | High |
| `JWT_REFRESH_SECRET` | JWT refresh token signing | High |
| `GEMINI_API_KEY` | LLM API access | Medium |
| `CORS_ORIGIN` | Allowed frontend origins | Medium |
| `DATABASE_URL` | Database connection | High |
| `SMTP_PASSWORD` | Email service password | High |

### Security Headers

Configure these security headers:

```javascript
// Security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://naijataste-ai.vercel.app"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true,
}));
```

## Security Best Practices

### Development

1. **Never commit secrets**: Use environment variables
2. **Use secure dependencies**: Regularly update packages
3. **Validate all input**: Use schema validation
4. **Sanitize output**: Prevent XSS
5. **Use HTTPS**: Always encrypt data in transit

### Production

1. **Enable SSL/TLS**: Use HTTPS in production
2. **Monitor logs**: Watch for suspicious activity
3. **Regular updates**: Keep dependencies updated
4. **Backup data**: Regular database backups
5. **Test security**: Regular penetration testing

### Database

1. **Use strong passwords**: bcrypt with cost 12
2. **Principle of least privilege**: Limit database access
3. **Regular backups**: Automated backup schedules
4. **Monitor queries**: Watch for suspicious patterns
5. **Use SSL**: Encrypt database connections

## Security Checklist

### Authentication & Authorization

- [ ] JWT tokens properly signed and validated
- [ ] Refresh tokens properly rotated
- [ ] Password hashing with bcrypt (cost 12)
- [ ] Rate limiting on auth endpoints
- [ ] Proper session management
- [ ] Role-based access control

### Input Validation

- [ ] All input validated with schemas
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] File upload validation
- [ ] Email format validation

### Data Protection

- [ ] Sensitive data encrypted
- [ ] SSL/TLS enabled
- [ ] Secure headers configured
- [ ] CORS properly configured
- [ ] Data masked in responses
- [ ] Backup procedures in place

### Monitoring

- [ ] Security logging enabled
- [ ] Intrusion detection
- [ ] Vulnerability scanning
- [ ] Performance monitoring
- [ ] Error tracking
- [ ] Alert systems configured

### Compliance

- [ ] GDPR compliance (data handling)
- [ ] CCPA compliance (if applicable)
- [ ] Data retention policies
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Cookie policy implemented