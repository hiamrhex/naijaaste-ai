# API Endpoints Reference

> Last verified: 2026-10-21 against live `/health` (31 endpoints).
> All endpoints return consistent error format: `{ error: { code, message, details?, requestId } }`.
> Rate-limited endpoints include `Retry-After` header on 429 responses.

## Health & Status

### GET /health
Returns API inventory and status.

**Response:**
```json
{
  "status": "ok",
  "endpoints": 31,
  "version": "0.0.0",
  "timestamp": "2026-10-21T20:53:00.000Z"
}
```

### GET /health/ready
Database connectivity check.

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-10-21T20:53:00.000Z"
}
```

## Authentication

### POST /auth/signup → 201
Create new user account.

**Request:**
```json
{
  "name": "Ada Obi",
  "email": "ada@example.com",
  "password": "Str0ng!Passw0rd"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "ada@example.com",
    "role": "user"
  },
  "accessToken": "jwt_token"
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Invalid input format
- `409 EMAIL_TAKEN` - Email already registered
- `429 RATE_LIMITED` - Too many signup attempts

### POST /auth/signin → 200
User login.

**Request:**
```json
{
  "email": "ada@example.com",
  "password": "Str0ng!Passw0rd"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "ada@example.com",
    "role": "user"
  },
  "accessToken": "jwt_token"
}
```

**Errors:**
- `401 INVALID_CREDENTIALS` - Wrong email or password

### POST /auth/refresh → 200
Refresh access token.

**Request:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "accessToken": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

### POST /auth/signout → 200
User logout.

**Request:**
```json
{
  "refreshToken": "refresh_token"
}
```

### GET /auth/me → 200
Get current user profile.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "ada@example.com",
    "role": "user"
  }
}
```

### DELETE /auth/me → 200
Delete user account.

### POST /auth/google → 200
Google sign-in.

**Request:**
```json
{
  "token": "google_id_token"
}
```

### POST /auth/forgot-password → 200
Request password reset.

**Request:**
```json
{
  "email": "ada@example.com"
}
```

### POST /auth/reset-password → 200
Reset password with token.

**Request:**
```json
{
  "token": "reset_token",
  "password": "New!Passw0rd"
}
```

## Discovery

### GET /nearby → 200
Find restaurants near user location.

**Query Parameters:**
- `lat` (required) - Latitude
- `lng` (required) - Longitude
- `radius` (optional) - Search radius in meters
- `maxPrice` (optional) - Maximum price level
- `minRating` (optional) - Minimum rating

**Response:**
```json
{
  "restaurants": [
    {
      "id": 1,
      "name": "Restaurant Name",
      "city": "Lagos",
      "lat": 6.5244,
      "lng": 3.3792,
      "average_rating": 4.5,
      "meta": { /* restaurant details */ }
    }
  ]
}
```

### GET /restaurants/geo → 200
Get restaurants by city and coordinates.

**Query Parameters:**
- `city` (required) - City name
- `lat` (optional) - Latitude for sorting
- `lng` (optional) - Longitude for sorting

## Agent & Chat

### POST /agent → 200
ReAct agent chat with restaurant recommendations.

**Request:**
```json
{
  "message": "Spicy amala in Yaba, tight budget",
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "response": "I found some great spicy amala options in Yaba...",
  "recommendations": [/* restaurant list */],
  "trace": [/* agent steps */]
}
```

### POST /chat → 200
Simple chat endpoint.

**Request:**
```json
{
  "message": "Hello",
  "sessionId": "uuid"
}
```

### GET /chat/:sessionId → 200
Get chat history.

### DELETE /chat/:sessionId → 200
Delete chat session.

## Taste & Preferences

### POST /extract-persona → 200
Extract taste preferences from chat.

**Request:**
```json
{
  "message": "I like spicy food and cheap places"
}
```

**Response:**
```json
{
  "persona": {
    "city": "Lagos",
    "budget": "low",
    "spice": "high",
    "ambience": "casual"
  }
}
```

### POST /update-preference → 200
Update user preferences.

**Request:**
```json
{
  "preference": {
    "maxPrice": "medium",
    "dietary": "vegetarian"
  }
}
```

### POST /recommend → 200
Get restaurant recommendations based on preferences.

**Request:**
```json
{
  "persona": { /* taste profile */ },
  "location": { lat, lng }
}
```

### POST /generate-review → 200
Generate AI review for restaurant.

**Request:**
```json
{
  "restaurantId": 1,
  "persona": { /* taste profile */ }
}
```

## Engagement

### POST /ratings → 200
Submit user rating.

**Request:**
```json
{
  "restaurantId": 1,
  "rating": 5,
  "comment": "Great food!"
}
```

### GET /ratings → 200
Get user ratings.

### POST /reports → 200
Submit user feedback.

**Request:**
```json
{
  "type": "bug",
  "message": "App crashed when searching",
  "details": { /* additional info */ }
}
```

## Admin

### GET /admin/stats → 200
Get system statistics (admin only).

**Response:**
```json
{
  "users": 100,
  "restaurants": 1000,
  "sessions": 500,
  "uptime": "99.9%"
}
```

### GET /admin/reports → 200
Get user reports (admin only).

### PATCH /admin/reports/:ticket → 200
Update report status (admin only).

## Favorites

### GET /auth/favorites → 200
Get user favorites.

### POST /auth/favorites → 200
Add restaurant to favorites.

**Request:**
```json
{
  "restaurantId": 1
}
```

### DELETE /auth/favorites/:restaurant_id → 200
Remove restaurant from favorites.

## Saved Places

### POST /auth/saved-places → 200
Save user location.

**Request:**
```json
{
  "name": "Home",
  "lat": 6.5244,
  "lng": 3.3792
}
```

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* additional context */ },
    "requestId": "unique_request_id"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid request format
- `INVALID_CREDENTIALS` - Wrong email/password
- `UNAUTHORIZED` - Missing or invalid token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `RATE_LIMITED` - Too many requests
- `PAYLOAD_TOO_LARGE` - Request too large
- `UPSTREAM_FAILURE` - LLM service unavailable
- `SERVICE_UNAVAILABLE` - Database or service down
- `AI_UNAVAILABLE` - LLM service unavailable
- `AI_TIMEOUT` - LLM request timed out

## Rate Limiting

Endpoints have different rate limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/signup` | 25 | 15 minutes |
| `/auth/signin` | 50 | 15 minutes |
| `/auth/refresh` | 60 | 15 minutes |
| `/auth/google` | 10 | 15 minutes |
| `/auth/forgot-password` | 10 | 15 minutes |
| `/auth/reset-password` | 20 | 15 minutes |
| LLM endpoints | 10 | minute |
| General API | 600 | 15 minutes |

Rate-limited responses include:
- `429` status code
- `Retry-After` header
- `RateLimit` headers showing limits