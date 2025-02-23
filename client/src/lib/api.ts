import { ResponseData } from "@/pages/home";

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
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

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

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Request failed: ${error.message}`);
    }
    throw new Error("Request failed");
  }
}