# Architecture Diagrams

This document contains visual representations of the NaijaTaste AI system architecture.

## System Overview

```mermaid
graph TB
  subgraph "Client Layer"
    A[Web Browser]
    B[Mobile App - PWA]
    C[API Clients]
  end
  
  subgraph "Frontend"
    D[Landing Page (/)]
    E[SPA Shell (/app)]
    F[React Components]
    G[Map Interface]
    H[Auth Screens]
  end
  
  subgraph "API Layer"
    I[Express API (/api)]
    J[Rate Limiting]
    K[JWT Middleware]
    L[Validation]
    M[Routes]
  end
  
  subgraph "Business Logic"
    N[Agent Loop]
    O[Chat Service]
    P[Recommendation Engine]
    Q[Review Generator]
    R[User Preferences]
  end
  
  subgraph "Data Layer"
    S[Postgres Database]
    T[User Store]
    U[Restaurant Data]
    V[Session Store]
    W[Rating Store]
  end
  
  subgraph "External Services"
    X[Gemini API]
    Y[Google Maps]
    Z[Email Service]
  end
  
  A --> D
  B --> E
  C --> I
  D --> E
  E --> I
  I --> J
  J --> K
  K --> L
  L --> M
  M --> N
  M --> O
  M --> P
  M --> Q
  M --> R
  N --> X
  O --> S
  P --> S
  Q --> X
  R --> S
  S --> T
  S --> U
  S --> V
  S --> W
  P --> Y
  O --> Z
```

## Data Flow

### User Registration Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web Browser
    participant API as Express API
    participant DB as Postgres
    participant Email as Email Service
    
    U->>W: Enter signup details
    W->>API: POST /auth/signup
    API->>DB: Check email exists
    DB-->>API: Email available
    API->>DB: Create user
    DB-->>API: User created
    API->>Email: Send verification (optional)
    Email-->>API: Email sent
    API-->>W: 201 Created
    W-->>U: Welcome message
```

### Restaurant Recommendation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web Browser
    participant API as Express API
    participant Agent as ReAct Agent
    participant LLM as Gemini API
    participant Tools as Agent Tools
    participant DB as Postgres
    participant Cache as Places Cache
    
    U->>W: "Spicy amala in Yaba"
    W->>API: POST /agent
    API->>Agent: Load session
    Agent->>LLM: Request reasoning
    LLM-->>Agent: Function call
    Agent->>Tools: Search restaurants
    Tools->>DB: Query restaurants
    DB-->>Tools: Restaurant list
    Tools-->>Agent: Results
    Agent->>LLM: Request recommendations
    LLM-->>Agent: Ranked list
    Agent-->>API: Response + trace
    API-->>W: Recommendations
    W-->>U: Display results
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web Browser
    participant API as Express API
    participant JWT as JWT Service
    participant DB as Postgres
    
    U->>W: Enter credentials
    W->>API: POST /auth/signin
    API->>DB: Verify user
    DB-->>API: User valid
    API->>JWT: Create access token
    JWT-->>API: Token created
    API->>JWT: Create refresh token
    JWT-->>API: Refresh token created
    API-->>W: 200 OK + tokens
    W->>W: Store tokens
    W-->>U: Logged in
```

## Component Architecture

### Frontend Components

```mermaid
graph TD
    subgraph "App Structure"
        A[App Router] --> B[HomeScreen]
        A --> C[MapScreen]
        A --> D[PlanScreen]
        A --> E[HistoryScreen]
        A --> F[SettingsScreen]
        A --> G[AdminScreen]
        A --> H[AuthScreen]
    end
    
    subgraph "Shared Components"
        I[Card] --> J[RestaurantCard]
        I --> K[SessionCard]
        I --> L[RatingCard]
        M[Sheet] --> N[AuthSheet]
        M --> O[SettingsSheet]
        P[TabBar] --> Q[MainTabBar]
        R[AuthGate] --> S[ProtectedRoutes]
    end
    
    subgraph "UI Components"
        T[Button] --> U[PrimaryButton]
        T --> V[SecondaryButton]
        W[Input] --> X[EmailInput]
        W --> Y[PasswordInput]
        Z[Map] --> AA[LeafletMap]
    end
    
    B --> I
    C --> Z
    D --> I
    E --> I
    F --> M
    G --> I
    H --> N
```

### Backend Architecture

```mermaid
graph TD
    subgraph "API Layer"
        A[Express Server] --> B[Rate Limiter]
        B --> C[JWT Middleware]
        C --> D[Validation]
        D --> E[Route Handlers]
    end
    
    subgraph "Business Logic"
        E --> F[Agent Service]
        E --> G[Chat Service]
        E --> H[Recommendation Service]
        E --> I[Review Service]
        E --> J[User Service]
    end
    
    subgraph "Data Access"
        F --> K[Database Pool]
        G --> K
        H --> K
        I --> K
        J --> K
        K --> L[Postgres Client]
        K --> M[pg-mem for tests]
    end
    
    subgraph "External Services"
        F --> N[Gemini API]
        H --> O[Places Cache]
        I --> P[Review Generator]
        J --> Q[Email Service]
    end
    
    subgraph "Utilities"
        R[Error Handler] --> E
        S[Logger] --> A
        T[Config] --> A
        U[Health Check] --> A
    end
```

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ sessions : "owns"
    users ||--o{ ratings : "creates"
    users ||--o{ reports : "submits"
    users ||--o{ favorites : "has"
    users ||--o{ saved_places : "has"
    users ||--o{ refresh_tokens : "has"
    
    users {
        UUID id PK
        TEXT email UK
        TEXT name
        TEXT password_hash
        TEXT role
        TEXT google_sub
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    sessions ||--o{ ratings : "contains"
    sessions {
        UUID id PK
        UUID user_id FK
        JSONB state
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    restaurants {
        SERIAL id PK
        TEXT osm_id UK
        TEXT name
        TEXT city
        DOUBLE lat
        DOUBLE lng
        JSONB meta
        DOUBLE average_rating
        BOOLEAN quality_flag
    }
    
    ratings {
        UUID id PK
        UUID session_id FK
        INTEGER restaurant_id FK
        INTEGER rating
        TEXT comment
        TIMESTAMP created_at
    }
    
    reports {
        UUID id PK
        UUID session_id FK
        TEXT type
        TEXT message
        JSONB details
        TEXT status
        TIMESTAMP created_at
    }
    
    favorites {
        SERIAL id PK
        UUID user_id FK
        INTEGER restaurant_id FK
        TIMESTAMP created_at
    }
    
    saved_places {
        UUID id PK
        UUID user_id FK
        TEXT name
        DOUBLE lat
        DOUBLE lng
        TIMESTAMP created_at
    }
    
    refresh_tokens {
        UUID id PK
        UUID user_id FK
        TEXT token_hash
        TIMESTAMP expires_at
        TIMESTAMP revoked_at
    }
    
    otps {
        UUID id PK
        TEXT email
        TEXT code_hash
        INTEGER attempts
        TIMESTAMP expires_at
        TIMESTAMP created_at
    }
    
    llm_quota {
        TEXT subject_id
        TEXT subject_type
        INTEGER tokens_used
        INTEGER tokens_limit
        TIMESTAMP reset_at
    }
    
    auth_attempts {
        UUID id PK
        TEXT email
        TEXT ip_address
        INTEGER attempts
        TIMESTAMP locked_until
    }
    
    schema_migrations {
        TEXT version PK
        TIMESTAMP applied_at
    }
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Vercel Platform"
        A[Edge Network] --> B[Static Landing]
        A --> C[SPA Application]
        A --> D[API Functions]
    end
    
    subgraph "Services"
        D --> E[Express API]
        E --> F[Rate Limiting]
        F --> G[JWT Validation]
        G --> H[Business Logic]
    end
    
    subgraph "Data Layer"
        H --> I[Neon Postgres]
        H --> J[Gemini API]
        H --> K[Email Service]
    end
    
    subgraph "Development"
        L[Local Development] --> M[Vite Dev Server]
        L --> N[Express API Server]
        L --> O[pg-mem Test DB]
    end
    
    B --> P[index.html]
    C --> Q[dist/app]
    D --> R[dist/api]
    I --> S[Production DB]
    I --> T[Test DB]
    J --> U[Gemini API]
    K --> V[SMTP/Email]
    M --> W[Hot Reload]
    N --> X[Local :3000]
    O --> Y[In-memory DB]
```

## Security Architecture

```mermaid
graph TD
    subgraph "Security Layers"
        A[Rate Limiting] --> B[Input Validation]
        B --> C[JWT Authentication]
        C --> D[Authorization]
        D --> E[Data Encryption]
        E --> F[Secure Headers]
    end
    
    subgraph "Authentication Flow"
        G[User Login] --> H[Password Verification]
        H --> I[JWT Generation]
        I --> J[Token Storage]
        J --> K[Token Validation]
        K --> L[Access Granted]
    end
    
    subgraph "Authorization Levels"
        M[Public Routes] --> N[/health, /nearby]
        O[User Routes] --> P[/auth/*, /chat/*]
        Q[Admin Routes] --> R[/admin/*]
    end
    
    subgraph "Security Measures"
        S[CORS Protection] --> T[Header Validation]
        U[SQL Injection Prevention] --> V[Parameterized Queries]
        W[XSS Protection] --> X[Output Encoding]
        Y[CSRF Protection] --> Z[Token Validation]
    end
    
    A --> G
    B --> G
    C --> G
    D --> O
    E --> F
    F --> S
    F --> U
    F --> W
    F --> Y
```

## Performance Architecture

```mermaid
graph TD
    subgraph "Performance Layers"
        A[Caching] --> B[Response Caching]
        A --> C[Data Caching]
        B --> D[CDN Cache]
        C --> E[Memory Cache]
    end
    
    subgraph "Optimization Techniques"
        F[Code Splitting] --> G[Lazy Loading]
        H[Image Optimization] --> I[WebP Format]
        J[Database Optimization] --> K[Indexing]
        L[Connection Pooling] --> M[Reuse Connections]
    end
    
    subgraph "Monitoring"
        N[Performance Metrics] --> O[Response Times]
        N --> P[Error Rates]
        N --> Q[Resource Usage]
        R[Health Checks] --> S[System Status]
        T[Logging] --> U[Debug Info]
    end
    
    D --> O
    E --> P
    G --> Q
    I --> O
    K --> P
    M --> Q
    O --> N
    P --> N
    Q --> N
    S --> R
    U --> T
```