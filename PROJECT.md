
# REST API Testing Tool Documentation

## Project Overview
A full-stack web application for testing, documenting, and managing REST/SOAP API requests with support for multiple environments and authentication methods.

## Project Structure
```
├── client/              # Frontend React application
│   ├── api/            # Saved API requests
│   ├── collections/    # API collections
│   ├── history/       # Request history
│   ├── imports/       # Import metadata
│   └── src/
│       ├── components/  # React components
│       ├── lib/        # Utility functions
│       ├── pages/      # Page components
│       └── types/      # TypeScript types
├── server/             # Backend Node.js server
│   ├── parser/        # API spec parsers
│   ├── routes/        # API endpoints
│   ├── services/      # Business logic
│   └── types/         # TypeScript types
└── shared/            # Shared types/schemas
```

## Frontend Components

### Core Components

#### RequestPanel
- Location: `client/src/components/request-panel.tsx`
- Purpose: Main request editing interface
- Features:
  - HTTP method selection
  - URL input with environment variables
  - Headers management
  - Query params editor
  - Request body editor (JSON)
  - Authentication settings

#### ImportDialog
- Location: `client/src/components/ui/import-dialog.tsx`
- Purpose: Import APIs from various sources
- Supports:
  - GitHub repositories
  - OpenAPI/Swagger specs
  - WSDL files
  - Collection files

#### EnvironmentSelector
- Location: `client/src/components/environment-selector.tsx`
- Purpose: Environment management
- Features:
  - Switch between environments (dev/qa/perf)
  - Environment variable editor
  - Environment-specific URLs

#### CollectionView
- Location: `client/src/components/collection-view.tsx`
- Purpose: Display and manage collections
- Features:
  - Tree view of requests
  - Collection grouping
  - Request filtering
  - Import information

### UI Components
- Button (`ui/button.tsx`): Custom button styles
- Dialog (`ui/dialog.tsx`): Modal dialogs
- Drawer (`ui/drawer.tsx`): Sliding panels
- Tabs (`ui/tabs.tsx`): Tab navigation
- Toast (`ui/toast.tsx`): Notifications
- Sidebar (`ui/sidebar.tsx`): Navigation sidebar

## Backend Services

### API Routes (`server/routes/`)

#### Import Routes (`/api/import/`)
```typescript
POST /api/import/github    # Import from GitHub
POST /api/import/wsdl      # Import SOAP APIs
POST /api/import/openapi   # Import OpenAPI specs
POST /api/import/collection # Import collections
```

#### Request Routes
```typescript
GET /api/requests         # Get all requests
POST /api/proxy          # Proxy API calls
GET /api/history/:id     # Get request history
POST /api/history        # Save request history
```

### Services

#### ApiDefinitionService
- Location: `server/services/ApiDefinitionService.ts`
- Purpose: Parse API definitions
- Features:
  - Extract requests from specs
  - Create standardized request objects
  - Handle different spec formats

#### SpringBootScanner
- Location: `server/services/SpringBootScanner.ts`
- Purpose: Scan Spring Boot projects
- Features:
  - Find endpoints and models
  - Parse Java annotations
  - Extract request/response types

## Data Models

### Request Schema
```typescript
{
  requestId: string
  name: string
  method: string
  baseUrl: string
  environments: {
    dev?: string
    qa01?: string
    qa02?: string
    qa03?: string
    perf?: string
  }
  queryParams: Record<string, any>
  pathVariables: Record<string, any>
  headers: Record<string, string>
  auth: {
    type: "none" | "basic" | "bearer" | "oauth2"
    config?: Record<string, any>
  }
  requestBody?: any
  responseFields?: any
  historyRequests: RequestHistory[]
}
```

### Collection Schema
```typescript
{
  id: string
  name: string
  description?: string
  requests: Request[]
  importData?: {
    source: string
    timestamp: string
    metadata: Record<string, any>
  }
}
```

## Authentication Methods
- None: No authentication
- Basic: Username/password
- Bearer: Token-based
- OAuth2: OAuth 2.0 flows (planned)

## Storage
- File-based storage for requests
- Collections stored as JSON
- Request history with limits
- Import metadata tracking

## Development Stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express
- Styling: Tailwind CSS + shadcn/ui
- State Management: React Query
- Form Handling: React Hook Form
- Validation: Zod schemas

## Error Handling
- Request validation using Zod
- Standard error responses
- Proxy error handling
- Import validation

## Future Enhancements
- OAuth2 support
- Response validation
- Test automation
- Mock server generation
- API documentation export
