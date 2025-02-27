import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Request History schema
export const RequestHistorySchema = z.object({
  method: z.string(),
  url: z.string(),
  requestBody: z.any().optional(),
  responseFields: z.record(z.any()).optional(),
  timestamp: z.string(),
  responseTime: z.number(),
});

// Main Request schema
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull(), // method + requestname
  routeId: text("route_id").notNull(), // method + requestname
  method: text("method").notNull(),
  baseUrl: text("base_url").notNull(),
  queryParams: jsonb("query_params").default('{}'),
  pathVariables: jsonb("path_variables").default('{}'),
  devEnvUrl: text("dev_env_url"),
  qa01EnvUrl: text("qa01_env_url"),
  qa02EnvUrl: text("qa02_env_url"),
  qa03EnvUrl: text("qa03_env_url"),
  perfEnvUrl: text("perf_env_url"),
  auth: jsonb("auth").default('{"type": "bearer", "token": "tiaa"}'),
  headers: jsonb("headers").default('{}'),
  historyId: text("history_id"), // "history" + requestId
  historyRequests: jsonb("history_requests").default('[]'), // Array of last 5 successful requests
  responseFields: jsonb("response_fields").default('{}'),
  requestBody: jsonb("request_body").default('{}'),
  exampleResponseBody: jsonb("example_response_body").default('{}'),
  tags: text("tags").array(),
  teamName: text("team_name"),
  collectionId: text("collection_id"),
  avgResponseTime: integer("avg_response_time"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertRequestSchema = createInsertSchema(requests)
  .extend({
    historyRequests: z.array(RequestHistorySchema).max(5).optional(),
    queryParams: z.record(z.any()).optional(),
    pathVariables: z.record(z.any()).optional(),
    headers: z.record(z.string()).optional(),
    auth: z.object({
      type: z.string(),
      token: z.string(),
    }).optional(),
    responseFields: z.record(z.any()).optional(),
    requestBody: z.record(z.any()).optional(),
    exampleResponseBody: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .omit({ 
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requests.$inferSelect;