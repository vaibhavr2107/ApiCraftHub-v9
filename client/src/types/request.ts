import { z } from "zod";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface QueryParam {
  key: string;
  value: string;
}

export interface AuthConfig {
  type: "none" | "basic" | "bearer";
  username?: string;
  password?: string;
  token?: string;
}

export interface SavedRequest {
  id: string;
  name: string;
  method: Method;
  url: string;
  queryParams: QueryParam[];
  auth: AuthConfig;
  body?: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
}

export const savedRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  url: z.string().url(),
  queryParams: z.array(z.object({
    key: z.string(),
    value: z.string()
  })),
  auth: z.object({
    type: z.enum(["none", "basic", "bearer"]),
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional()
  }),
  body: z.string().optional()
});
