import { z } from "zod";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface QueryParam {
  key: string;
  value: string;
}

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export type BodyType = "none" | "form-data" | "x-www-form-urlencoded" | "raw";
export type RawBodyFormat = "json" | "text" | "html" | "xml" | "javascript";

export interface BodyConfig {
  type: BodyType;
  rawFormat?: RawBodyFormat;
  formData?: Array<{ key: string; value: string; type: "text" | "file" }>;
  urlEncoded?: Array<{ key: string; value: string }>;
  raw?: string;
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
  headers: Header[];
  auth: AuthConfig;
  body: BodyConfig;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  contentType?: string;
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
  headers: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean()
  })),
  auth: z.object({
    type: z.enum(["none", "basic", "bearer"]),
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional()
  }),
  body: z.object({
    type: z.enum(["none", "form-data", "x-www-form-urlencoded", "raw"]),
    rawFormat: z.enum(["json", "text", "html", "xml", "javascript"]).optional(),
    formData: z.array(z.object({
      key: z.string(),
      value: z.string(),
      type: z.enum(["text", "file"])
    })).optional(),
    urlEncoded: z.array(z.object({
      key: z.string(),
      value: z.string()
    })).optional(),
    raw: z.string().optional()
  })
});