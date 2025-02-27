import { z } from "zod";

// Request History schema
export const RequestHistorySchema = z.object({
  method: z.string(),
  url: z.string(),
  requestBody: z.any().optional(),
  responseFields: z.record(z.any()).optional(),
  timestamp: z.string(),
  responseTime: z.number(),
});

export type RequestHistory = z.infer<typeof RequestHistorySchema>;

// Main Request schema
export const RequestSchema = z.object({
  requestId: z.string(), // method + requestname
  routeId: z.string(), // method + requestname
  name: z.string(), // Add name field that was missing
  method: z.string(),
  baseUrl: z.string(),
  queryParams: z.record(z.any()).default({}),
  pathVariables: z.record(z.any()).default({}),
  devEnvUrl: z.string().optional(),
  qa01EnvUrl: z.string().optional(),
  qa02EnvUrl: z.string().optional(),
  qa03EnvUrl: z.string().optional(),
  perfEnvUrl: z.string().optional(),
  auth: z.object({
    type: z.string(),
    token: z.string().optional(), // Make token optional
    basic: z.object({
      username: z.string(),
      password: z.string()
    }).optional(),
    bearer: z.object({
      token: z.string()
    }).optional(),
    oauth2: z.any().optional()
  }).default({ type: "bearer", token: "tiaa" }),
  headers: z.record(z.string()).default({}),
  historyId: z.string(), // "history" + requestId
  historyRequests: z.array(RequestHistorySchema).max(5).default([]),
  responseFields: z.record(z.any()).default({}),
  requestBody: z.record(z.any()).default({}),
  exampleResponseBody: z.record(z.any()).default({}),
  tags: z.array(z.string()).default([]),
  teamName: z.string().optional(),
  collectionId: z.string().optional(),
  avgResponseTime: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().default(1), // For handling duplicate request/route IDs
  selectedEnvironment: z.string().optional() // Add selectedEnvironment field
});

export type Request = z.infer<typeof RequestSchema>;

// For creating new requests
export const CreateRequestSchema = RequestSchema.omit({
  createdAt: true,
  updatedAt: true,
  version: true,
  historyId: true,
  avgResponseTime: true,
});

export type CreateRequest = z.infer<typeof CreateRequestSchema>;

// Users schema (keeping this for authentication if needed)
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({ id: true });
export type CreateUser = z.infer<typeof CreateUserSchema>;