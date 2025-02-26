import { z } from "zod";
import { nanoid } from "nanoid";
import { Environment } from "./environment";
import { generateRequestId, generateRouteId } from "@/lib/utils";

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
  enabled: boolean;
  description?: string;
}

// Request Body Types
export type BodyType = "none" | "form-data" | "x-www-form-urlencoded" | "raw";
export type RawFormat = "json" | "text" | "xml" | "html";

export interface RequestBody {
  type: BodyType;
  rawFormat?: RawFormat;
  content: string;
  formData?: Array<{
    key: string;
    value: string;
    type: "text" | "file";
    enabled: boolean;
  }>;
  urlEncoded?: Array<{
    key: string;
    value: string;
    enabled: boolean;
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
  oauth2?: any;
}

// Response Data Structure
export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time: number;
  size: number;
  timestamp: string;
}

// Main API Request Interface
export interface ApiRequest {
  id: string;
  routeId: string; // Added routeId field
  name: string;
  method: HttpMethod;
  url: string;
  description?: string;
  queryParams: RequestParameter[];
  headers: RequestParameter[];
  pathVariables: RequestParameter[];
  body: RequestBody;
  auth: RequestAuth;
  collectionId?: string;
  collectionName?: string;
  lastResponse?: ApiResponse;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  selectedEnvironment: Environment;
}

// Helper function to create a new API request
export function createApiRequest(params: Partial<ApiRequest>): ApiRequest {
  const now = new Date().toISOString();
  const id = nanoid();

  // Generate route ID based on name and collection
  const routeId = params.routeId || generateRouteId(params.name || "New Request", params.collectionName);

  const request: ApiRequest = {
    id,
    routeId,
    name: params.name || "New Request",
    method: params.method || "GET",
    url: params.url || "",
    queryParams: params.queryParams || [{ key: "", value: "", enabled: true }],
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
    collectionName: params.collectionName,
    selectedEnvironment: params.selectedEnvironment || "dev",
    ...params,
  };

  return request;
}

// Validation schema for API request
export const apiRequestSchema = z.object({
  id: z.string(),
  routeId: z.string(), // Added validation for routeId
  name: z.string().min(1),
  method: HttpMethod,
  url: z.string().min(1),
  description: z.string().optional(),
  queryParams: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean(),
    description: z.string().optional()
  })),
  headers: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean(),
    description: z.string().optional()
  })),
  pathVariables: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean(),
    description: z.string().optional()
  })),
  body: z.object({
    type: z.enum(["none", "form-data", "x-www-form-urlencoded", "raw"]),
    rawFormat: z.enum(["json", "text", "xml", "html"]).optional(),
    content: z.string(),
    formData: z.array(z.object({
      key: z.string(),
      value: z.string(),
      type: z.enum(["text", "file"]),
      enabled: z.boolean()
    })).optional(),
    urlEncoded: z.array(z.object({
      key: z.string(),
      value: z.string(),
      enabled: z.boolean()
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
  tags: z.array(z.string()).optional(),
  selectedEnvironment: z.enum(["dev", "qa01", "qa02", "qa03", "perf", "prod"]),
  collectionName: z.string().optional()
});