
# API Request Schema Documentation

## Core Types

### Request
The main request schema that defines the structure of API requests:

```typescript
{
  requestId: string,        // Unique identifier (method + requestname)
  routeId: string,         // Route identifier (method + requestname)
  name: string,            // Display name of the request
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS",
  baseUrl: string,         // Base URL of the request
  
  // Environment URLs
  devUrl?: string,         // Development environment URL
  qa01Url?: string,        // QA01 environment URL
  qa02Url?: string,        // QA02 environment URL
  qa03Url?: string,        // QA03 environment URL
  perfUrl?: string,        // Performance environment URL
  prodUrl?: string,        // Production environment URL
  
  // Request parameters
  queryParams: Record<string, any>,     // Query parameters
  pathVariables: Record<string, any>,   // Path variables
  headers: Record<string, string>,      // Request headers
  
  // Authentication
  auth: {
    type: "none" | "basic" | "bearer" | "bearer-tiaa" | "oauth2",
    basic?: {
      username: string,
      password: string
    },
    bearer?: {
      token: string
    },
    oauth2?: any
  },
  
  // Request/Response data
  requestBody: Record<string, any>,
  responseFields: Record<string, any>,
  exampleResponseBody: Record<string, any> | Array<any>,
  
  // History tracking
  historyId: string,
  historyRequests: RequestHistory[],
  
  // Metadata
  tags: string[],
  teamName?: string,
  collectionId?: string,
  collectionName?: string,
  avgResponseTime?: number,
  createdAt: string,
  updatedAt: string,
  version: number,
  selectedEnvironment: "dev" | "qa01" | "qa02" | "qa03" | "perf" | "prod"
}
```

### RequestHistory
Schema for tracking request history:

```typescript
{
  method: string,
  url: string,
  requestBody?: any,
  responseFields: any,
  timestamp: string,
  responseTime: number
}
```

### Collection
Schema for grouping requests:

```typescript
{
  id: string,
  name: string,
  description?: string,
  requests: Request[],
  importData?: Record<string, any>  // Store import metadata
}
```

### EnvironmentUrl
Schema for environment-specific URLs:

```typescript
{
  devUrl?: string,
  qa01Url?: string,
  qa02Url?: string,
  qa03Url?: string,
  perfUrl?: string,
  prodUrl?: string
}
```

## Usage Examples

### Basic Request Example
```typescript
{
  "requestId": "get-users",
  "routeId": "get-users",
  "name": "Get Users",
  "method": "GET",
  "baseUrl": "/api/users",
  "auth": { "type": "bearer-tiaa" },
  "queryParams": { "page": "1", "limit": "10" },
  "pathVariables": {},
  "headers": { "Accept": "application/json" }
}
```

### Collection Example
```typescript
{
  "id": "user-management",
  "name": "User Management API",
  "description": "APIs for managing users",
  "requests": [/* Array of Request objects */]
}
```
