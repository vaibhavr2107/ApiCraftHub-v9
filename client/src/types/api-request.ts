import { z } from "zod";
import { nanoid } from "nanoid";

// Request Method Types
export const HttpMethod = z.enum([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS"
]);

export type HttpMethod = z.infer<typeof HttpMethod>;

// Parameter Types (Query, Headers, etc)
export interface RequestParameter {
  key: string;
  value: string;
  enabled?: boolean;
  description?: string;
}

// Request Body Types
export interface RequestBody {
  type: "none" | "form-data" | "x-www-form-urlencoded" | "raw";
  rawFormat?: "json" | "text" | "xml" | "html";
  content?: string;
  formData?: Array<{
    key: string;
    value: string;
    type: "text" | "file";
    enabled?: boolean;
  }>;
  urlEncoded?: Array<{
    key: string;
    value: string;
    enabled?: boolean;
  }>;
}

// Authentication Types
export interface RequestAuth {
  type: "none" | "basic" | "bearer" | "oauth2";
  basic?: {
    username: string;
    password: string;
  };
  bearer?: {
    token: string;
  };
  oauth2?: any; // To be implemented later
}

// Response Data Structure
export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time: number; // Response time in milliseconds
  size: number; // Response size in bytes
  timestamp: string; // When the response was received
}

// Main API Request Interface
export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  description?: string;

  // Request Components
  queryParams: RequestParameter[];
  headers: RequestParameter[];
  pathVariables: RequestParameter[];
  body: RequestBody;
  auth: RequestAuth;

  // Collection Reference (if part of a collection)
  collectionId?: string;

  // Response Data (if request has been executed)
  lastResponse?: ApiResponse;

  // Metadata
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// Helper function to generate a unique request name
export function generateRequestName(baseName: string): string {
  const timestamp = new Date().toISOString();
  return `${baseName}_${timestamp}`;
}

// Helper function to create a new API request
export function createApiRequest(params: Partial<ApiRequest>): ApiRequest {
  const now = new Date().toISOString();

  return {
    id: nanoid(),
    name: params.name || generateRequestName("Request"),
    method: params.method || "GET",
    url: params.url || "",
    queryParams: params.queryParams || [],
    headers: params.headers || [
      { key: "Accept", value: "*/*", enabled: true },
      { key: "User-Agent", value: "API-Tester/1.0", enabled: true }
    ],
    pathVariables: params.pathVariables || [],
    body: params.body || {
      type: "none",
      rawFormat: "json",
      content: "",
    },
    auth: params.auth || { type: "none" },
    createdAt: now,
    updatedAt: now,
    collectionId: params.collectionId,
    ...params
  };
}

// Validation schema for API request
export const apiRequestSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  method: HttpMethod,
  url: z.string().min(1),
  description: z.string().optional(),
  queryParams: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().optional(),
    description: z.string().optional()
  })),
  headers: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().optional(),
    description: z.string().optional()
  })),
  pathVariables: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().optional(),
    description: z.string().optional()
  })),
  body: z.object({
    type: z.enum(["none", "form-data", "x-www-form-urlencoded", "raw"]),
    rawFormat: z.enum(["json", "text", "xml", "html"]).optional(),
    content: z.string().optional(),
    formData: z.array(z.object({
      key: z.string(),
      value: z.string(),
      type: z.enum(["text", "file"]),
      enabled: z.boolean().optional()
    })).optional(),
    urlEncoded: z.array(z.object({
      key: z.string(),
      value: z.string(),
      enabled: z.boolean().optional()
    })).optional()
  }),
  auth: z.object({
    type: z.enum(["none", "basic", "bearer", "oauth2"]),
    basic: z.object({
      username: z.string(),
      password: z.string()
    }).optional(),
    bearer: z.object({
      token: z.string()
    }).optional(),
    oauth2: z.any().optional()
  }),
  collectionId: z.string().optional(),
  lastResponse: z.object({
    status: z.number(),
    statusText: z.string(),
    headers: z.record(z.string()),
    data: z.any(),
    time: z.number(),
    size: z.number(),
    timestamp: z.string()
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).optional()
});