# Best Practices Guide

This document outlines best practices for developing and maintaining NaijaTaste AI.

## Code Quality

### JavaScript/TypeScript Best Practices

#### Naming Conventions
- Use descriptive, meaningful variable and function names
- Follow camelCase for variables and functions
- Use PascalCase for classes and constructors
- Use UPPER_CASE for constants

```javascript
// Good
const userRepository = new UserRepository();
const getUserById = (id) => { /* ... */ };
const MAX_RETRY_ATTEMPTS = 3;

// Bad
const usr = new UserRepo();
const getusr = (id) => { /* ... */ };
const maxretry = 3;
```

### Error Handling

#### Use Proper Error Handling
```javascript
// Good
try {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
} catch (error) {
  logger.error('Failed to get user:', error);
  throw new AppError('Failed to get user', 500);
}

// Bad
try {
  const user = await userRepository.findById(userId);
  return user;
} catch (error) {
  return null;
}
```

#### Create Custom Error Classes
```javascript
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}
```

### Database Best Practices

#### Use Parameterized Queries
```javascript
// Good
const query = 'SELECT * FROM users WHERE email = $1';
const result = await pool.query(query, [email]);

// Bad
const query = `SELECT * FROM users WHERE email = '${email}'`;
const result = await pool.query(query);
```

#### Handle Connection Pooling
```javascript
// Good
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Always release connections
const client = await pool.connect();
try {
  const result = await client.query('SELECT * FROM users');
  return result.rows;
} finally {
  client.release();
}
```

### Security Best Practices

#### Validate All Input
```javascript
// Good
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
});

function validateSignup(req, res, next) {
  const result = signupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: result.error.errors
      }
    });
  }
  next();
}

// Bad
function signup(req, res) {
  const { name, email, password } = req.body;
  // No validation
  // ...
}
```

#### Use Proper Authentication
```javascript
// Good
import jwt from 'jsonwebtoken';

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

// Bad
function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (token) {
    req.user = { id: '123' }; // Hardcoded
    next();
  }
}
```

## API Design

### RESTful API Design

#### Use Proper HTTP Methods
```javascript
// Good
app.get('/users', getUsers);           // List users
app.post('/users', createUser);        // Create user
app.get('/users/:id', getUser);        // Get specific user
app.put('/users/:id', updateUser);     // Update user
app.delete('/users/:id', deleteUser);   // Delete user

// Bad
app.get('/get-user', getUser);         // Not RESTful
app.post('/update-user', updateUser);   // Not RESTful
```

#### Consistent Error Responses
```javascript
// Good
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      details: err.details || null,
      requestId: req.id
    }
  });
});

// Bad
app.use((err, req, res, next) => {
  res.status(500).send('Something went wrong');
});
```

### Rate Limiting

#### Implement Rate Limiting
```javascript
// Good
import rateLimit from 'express-rate-limit';

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

app.use('/auth', authLimiter);
app.use('/api', apiLimiter);

// Bad
// No rate limiting
```

## Testing Best Practices

### Write Comprehensive Tests

#### Unit Tests
```javascript
// Good
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './UserService';
import { UserRepository } from './UserRepository';

describe('UserService', () => {
  let userService;
  let userRepository;

  beforeEach(() => {
    userRepository = new UserRepository();
    userService = new UserService(userRepository);
  });

  it('should create a new user', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123!'
    };

    const user = await userService.create(userData);
    expect(user).toBeDefined();
    expect(user.email).toBe('john@example.com');
    expect(user.name).toBe('John Doe');
  });

  it('should throw error for duplicate email', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123!'
    };

    await userService.create(userData);
    
    await expect(userService.create(userData)).rejects.toThrow('EMAIL_TAKEN');
  });
});

// Bad
// No tests
```

#### Integration Tests
```javascript
// Good
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server';

describe('Auth API', () => {
  it('should signup a new user', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('john@example.com');
  });

  it('should not signup with duplicate email', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123!'
    };

    await request(app).post('/auth/signup').send(userData);
    
    const response = await request(app).post('/auth/signup').send(userData);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });
});

// Bad
// No integration tests
```

### Test Coverage

#### Aim for High Coverage
- Target 80%+ test coverage
- Test both success and failure cases
- Test edge cases and error conditions
- Use mocking for external dependencies

```javascript
// Good
import { vi } from 'vitest';

// Mock external dependency
vi.mock('./database', () => ({
  getUser: vi.fn().mockResolvedValue({ id: 1, name: 'John' })
}));

// Test with mocked dependency
test('should get user from database', async () => {
  const user = await getUser(1);
  expect(user).toEqual({ id: 1, name: 'John' });
});

// Bad
// No mocking, tests depend on external services
```

## Performance Best Practices

### Optimize Database Queries

#### Use Indexes
```sql
-- Good
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_restaurants_city ON restaurants(city);
CREATE INDEX idx_restaurants_location ON restaurants(lat, lng);

-- Bad
-- No indexes
```

#### Optimize Queries
```javascript
// Good
async function getNearbyRestaurants(lat, lng, radius = 5000) {
  const query = `
    SELECT *, 
           earth_distance(
             ll_to_earth(lat, lng), 
             ll_to_earth($1, $2)
           ) as distance
    FROM restaurants 
    WHERE earth_distance(
      ll_to_earth(lat, lng), 
      ll_to_earth($1, $2)
    ) <= $3
    ORDER BY distance
    LIMIT 20
  `;
  
  const result = await pool.query(query, [lat, lng, radius / 1000]);
  return result.rows;
}

// Bad
async function getNearbyRestaurants(lat, lng) {
  const query = 'SELECT * FROM restaurants';
  const result = await pool.query(query);
  return result.rows.filter(r => {
    const distance = calculateDistance(lat, lng, r.lat, r.lng);
    return distance <= 5000;
  });
}
```

### Use Caching

#### Implement Response Caching
```javascript
// Good
const cache = new Map();

function cacheResponse(req, res, next) {
  const key = req.originalUrl;
  if (cache.has(key)) {
    return res.json(cache.get(key));
  }
  
  const originalJson = res.json;
  res.json = function(body) {
    cache.set(key, body);
    originalJson.call(this, body);
  };
  
  next();
}

// Apply to specific routes
app.get('/api/restaurants', cacheResponse, getRestaurants);

// Bad
// No caching
```

## Security Best Practices

### Input Validation

#### Validate All User Input
```javascript
// Good
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-zA-Z\s]+$/),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  age: z.number().min(18).max(120).optional(),
});

function validateUser(req, res, next) {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: result.error.errors
      }
    });
  }
  next();
}

// Bad
// No validation
```

### SQL Injection Prevention

#### Use Parameterized Queries
```javascript
// Good
async function getUserByEmail(email) {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  return result.rows[0];
}

// Bad
async function getUserByEmail(email) {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  const result = await pool.query(query);
  return result.rows[0];
}
```

### XSS Prevention

#### Sanitize Output
```javascript
// Good
import DOMPurify from 'dompurify';

function sanitizeInput(input) {
  return DOMPurify.sanitize(input);
}

function renderUserComment(comment) {
  const safeComment = sanitizeInput(comment);
  return `<div class="comment">${safeComment}</div>`;
}

// Bad
function renderUserComment(comment) {
  return `<div class="comment">${comment}</div>`;
}
```

## Documentation Best Practices

### Document APIs

#### Use OpenAPI/Swagger
```javascript
// Good
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
app.get('/api/users', getUsers);

// Bad
// No API documentation
```

### Code Comments

#### Write Meaningful Comments
```javascript
// Good
/**
 * Validates user input and creates a new user account
 * @param {Object} userData - User data object
 * @param {string} userData.name - User's full name
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - User's password
 * @returns {Promise<Object>} Created user object
 * @throws {ValidationError} If input validation fails
 * @throws {Error} If user creation fails
 */
async function createUser(userData) {
  // Validate input data
  const validated = userSchema.parse(userData);
  
  // Check if email already exists
  const existingUser = await getUserByEmail(validated.email);
  if (existingUser) {
    throw new Error('EMAIL_TAKEN');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(validated.password, 12);
  
  // Create user
  const user = await userRepository.create({
    ...validated,
    passwordHash
  });
  
  return user;
}

// Bad
// No comments
```

## Git Best Practices

### Commit Messages

#### Use Conventional Commits
```bash
# Good
git commit -m "feat: add user authentication endpoints"
git commit -m "fix: resolve SQL injection vulnerability"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for user service"
git commit -m "chore: update dependencies"

# Bad
git commit -m "fixed stuff"
git commit -m "updated code"
git commit -m "changes"
```

### Branch Management

#### Use Descriptive Branch Names
```bash
# Good
git checkout -m feature/user-authentication
git checkout -m fix/database-connection
git checkout -m docs/api-documentation
git checkout -m test/user-service-tests

# Bad
git checkout -m fix1
git checkout -m new
git checkout -m update
```

## Deployment Best Practices

### Environment Variables

#### Use Environment Variables
```javascript
// Good
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// Bad
const PORT = 3000;
const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
const JWT_SECRET = 'super-secret-key';
```

### Configuration Management

#### Use Configuration Files
```javascript
// Good
// config/database.js
export const database = {
  url: process.env.DATABASE_URL,
  pool: {
    max: 20,
    min: 5,
    idle: 30000
  }
};

// src/server.js
import { database } from './config/database.js';

const pool = new Pool(database);

// Bad
// Configuration hardcoded in code
```

## Monitoring and Logging

### Logging

#### Use Structured Logging
```javascript
// Good
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('User created', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString()
});

logger.error('Database connection failed', {
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});

// Bad
console.log('User created:', user.id);
console.error('Error:', error);
```

### Error Tracking

#### Implement Error Tracking
```javascript
// Good
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// Usage
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  Sentry.captureException(error);
  throw error;
}

// Bad
// No error tracking
```

## Performance Monitoring

### Monitor Key Metrics

#### Track Performance Metrics
```javascript
// Good
import { performance } from 'perf_hooks';

app.use((req, res, next) => {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    const memoryUsage = process.memoryUsage();
    
    console.log({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
      timestamp: new Date().toISOString()
    });
  });
  
  next();
});

// Bad
// No performance monitoring
```

## Testing Checklist

### Before Committing

- [ ] All tests pass
- [ ] New functionality has tests
- [ ] Edge cases are covered
- [ ] Error conditions are tested
- [ ] Performance tests are included
- [ ] Security tests are included
- [ ] Integration tests pass
- [ ] E2E tests pass

### Before Deployment

- [ ] All tests pass
- [ ] Code is reviewed
- [ ] Documentation is updated
- [ ] Security checks pass
- [ ] Performance benchmarks are met
- [ ] Error tracking is configured
- [ ] Monitoring is set up
- [ ] Rollback plan exists

## Security Checklist

### Before Deployment

- [ ] Input validation is implemented
- [ ] SQL injection prevention is in place
- [ ] XSS protection is implemented
- [ ] CSRF protection is enabled
- [ ] Rate limiting is configured
- [ ] Authentication is secure
- [ ] Authorization is implemented
- [ ] Environment variables are secured
- [ ] Dependencies are updated and scanned
- [ ] Security tests pass

## Performance Checklist

### Before Deployment

- [ ] Database queries are optimized
- [ ] Caching is implemented
- [ ] Static assets are optimized
- [ ] Bundle size is minimized
- [ ] Performance tests pass
- [ ] Load tests pass
- [ ] Monitoring is configured
- [ ] Error handling is optimized
- [ ] Memory usage is monitored
- [ ] Response times are acceptable

## Conclusion

Following these best practices will help ensure that NaijaTaste AI is:
- Secure and reliable
- Performant and scalable
- Well-tested and maintainable
- Well-documented and easy to understand
- Deployable with confidence

Remember that best practices are guidelines, not rigid rules. Always consider the specific context and requirements of your project when applying these practices.