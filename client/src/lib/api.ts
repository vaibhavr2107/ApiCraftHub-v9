import { ResponseData } from "@/types/request";

interface RequestOptions {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function makeRequest({
  method,
  url,
  body,
  headers = {},
}: RequestOptions): Promise<ResponseData> {
  try {
    const startTime = performance.now();

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseTime = Math.round(performance.now() - startTime);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Parse cookies from response headers
    const cookies: Record<string, string> = {};
    const cookieHeader = response.headers.get("set-cookie");
    if (cookieHeader) {
      cookieHeader.split(",").forEach(cookie => {
        const [name, ...parts] = cookie.split("=");
        cookies[name.trim()] = parts.join("=").split(";")[0].trim();
      });
    }

    // Calculate response size
    const size = new TextEncoder().encode(JSON.stringify(data)).length;

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      time: responseTime,
      size,
      cookies,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Request failed: ${error.message}`);
    }
    throw new Error("Request failed");
  }
}