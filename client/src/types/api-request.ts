import { z } from "zod";
import { Request, RequestSchema } from "@shared/schema";
import { generateRequestId, generateRouteId } from "@/lib/utils";

// Re-export the types from shared schema
export type { Request } from "@shared/schema";

// Export the HTTP methods enum
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

// Response Data Structure
export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time?: number;
  size?: number;
  timestamp?: string;
}

// Helper function to create a new request
export function createApiRequest(params: Partial<Request>): Request {
  const now = new Date().toISOString();
  const routeId = params.routeId || generateRouteId(params.name || "New Request", params.collectionName);
  const requestId = params.requestId || generateRequestId(params.name || "New Request");

  const request: Request = {
    requestId,
    routeId,
    name: params.name || "New Request",
    method: params.method || "GET",
    baseUrl: params.baseUrl || "",
    queryParams: params.queryParams || {},
    pathVariables: params.pathVariables || {},
    auth: params.auth || { type: "bearer-tiaa" },
    headers: params.headers || {},
    historyId: `history-${requestId}`,
    historyRequests: [],
    responseFields: {},
    requestBody: {},
    exampleResponseBody: {},
    tags: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
    selectedEnvironment: params.selectedEnvironment || "qa01",
    collectionId: params.collectionId,
    collectionName: params.collectionName,
    ...params
  };

  return RequestSchema.parse(request); // Validate against schema
}

//This part is removed because it's replaced by the shared schema.  
// export type BodyType = "none" | "form-data" | "x-www-form-urlencoded" | "raw";
// export type RawFormat = "json" | "text" | "xml" | "html";

//This part is removed because it's replaced by the shared schema.
// export interface RequestBody {
//   type: BodyType;
//   rawFormat?: RawFormat;
//   content: string;
//   formData?: Array<{
//     key: string;
//     value: string;
//     type: "text" | "file";
//     enabled: boolean;
//   }>;
//   urlEncoded?: Array<{
//     key: string;
//     value: string;
//     enabled: boolean;
//   }>;
// }


//This part is removed because it's replaced by the shared schema.
// export interface RequestAuth {
//   type: "none" | "basic" | "bearer" | "bearer-tiaa" | "oauth2";
//   basic?: {
//     username: string;
//     password: string;
//   };
//   bearer?: {
//     token: string;
//   };
//   oauth2?: any;
// }

//This part is removed because it's replaced by the shared schema.
// export interface ApiResponse {
//   status: number;
//   statusText: string;
//   headers: Record<string, string>;
//   data: any;
//   time: number;
//   size: number;
//   timestamp: string;
// }

//This part is removed because it's replaced by the shared schema.
// export interface ApiRequest {
//   id: string;
//   routeId: string;
//   name: string;
//   method: HttpMethod;
//   url: string;
//   description?: string;
//   queryParams: RequestParameter[];
//   headers: RequestParameter[];
//   pathVariables: RequestParameter[];
//   body: RequestBody;
//   auth: RequestAuth;
//   collectionId?: string;
//   collectionName?: string;
//   lastResponse?: ApiResponse;
//   createdAt: string;
//   updatedAt: string;
//   tags?: string[];
//   selectedEnvironment: Environment;
// }

//This part is removed because it's replaced by the shared schema.
// export function createApiRequest(params: Partial<ApiRequest>): ApiRequest {
//   const now = new Date().toISOString();
//   const id = nanoid();
//   const routeId = params.routeId || generateRouteId(params.name || "New Request", params.collectionName);
//   const request: ApiRequest = {
//     id,
//     routeId,
//     name: params.name || "New Request",
//     method: params.method || "GET",
//     url: params.url || "",
//     queryParams: params.queryParams || [{ key: "", value: "", enabled: true }],
//     headers: params.headers || [
//       { key: "Accept", value: "*/*", enabled: true },
//       { key: "User-Agent", value: "API-Tester/1.0", enabled: true }
//     ],
//     pathVariables: params.pathVariables || [],
//     body: params.body || {
//       type: "none",
//       rawFormat: "json",
//       content: "",
//     },
//     auth: params.auth || { type: "none" },
//     createdAt: now,
//     updatedAt: now,
//     collectionId: params.collectionId,
//     collectionName: params.collectionName,
//     selectedEnvironment: params.selectedEnvironment || "dev",
//     ...params,
//   };
//   return request;
// }

//This part is removed because it's replaced by the shared schema.
// export const apiRequestSchema = z.object({
//   id: z.string(),
//   routeId: z.string(),
//   name: z.string().min(1),
//   method: HttpMethod,
//   url: z.string().min(1),
//   description: z.string().optional(),
//   queryParams: z.array(z.object({
//     key: z.string(),
//     value: z.string(),
//     enabled: z.boolean(),
//     description: z.string().optional()
//   })),
//   headers: z.array(z.object({
//     key: z.string(),
//     value: z.string(),
//     enabled: z.boolean(),
//     description: z.string().optional()
//   })),
//   pathVariables: z.array(z.object({
//     key: z.string(),
//     value: z.string(),
//     enabled: z.boolean(),
//     description: z.string().optional()
//   })),
//   body: z.object({
//     type: z.enum(["none", "form-data", "x-www-form-urlencoded", "raw"]),
//     rawFormat: z.enum(["json", "text", "xml", "html"]).optional(),
//     content: z.string(),
//     formData: z.array(z.object({
//       key: z.string(),
//       value: z.string(),
//       type: z.enum(["text", "file"]),
//       enabled: z.boolean()
//     })).optional(),
//     urlEncoded: z.array(z.object({
//       key: z.string(),
//       value: z.string(),
//       enabled: z.boolean()
//     })).optional()
//   }),
//   auth: z.object({
//     type: z.enum(["none", "basic", "bearer", "bearer-tiaa", "oauth2"]),
//     basic: z.object({
//       username: z.string(),
//       password: z.string()
//     }).optional(),
//     bearer: z.object({
//       token: z.string()
//     }).optional(),
//     oauth2: z.any().optional()
//   }),
//   collectionId: z.string().optional(),
//   lastResponse: z.object({
//     status: z.number(),
//     statusText: z.string(),
//     headers: z.record(z.string()),
//     data: z.any(),
//     time: z.number(),
//     size: z.number(),
//     timestamp: z.string()
//   }).optional(),
//   createdAt: z.string(),
//   updatedAt: z.string(),
//   tags: z.array(z.string()).optional(),
//   selectedEnvironment: z.enum(["dev", "qa01", "qa02", "qa03", "perf", "prod"]),
//   collectionName: z.string().optional()
// });