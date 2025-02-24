import type { ResponseData } from "@/types/api-request";

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
  let timeoutId: NodeJS.Timeout;
  let controller: AbortController;

  try {
    // Validate URL
    if (!url) {
      throw new Error("URL is required");
    }

    // Ensure URL is properly formatted
    let requestUrl: string;
    try {
      requestUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(requestUrl); // Validate URL format
    } catch (urlError) {
      throw new Error("Invalid URL format. Please check the URL and try again.");
    }

    // Setup timeout controller
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Wrap fetch in a try-catch to handle network errors
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      }).catch((fetchError) => {
        throw fetchError;
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        throw new Error("Request timed out after 30 seconds");
      }

      // Check for network connectivity
      if (!navigator.onLine) {
        throw new Error("No internet connection. Please check your network and try again.");
      }

      // Handle DNS resolution failures and other network errors
      const hostname = new URL(requestUrl).hostname;
      throw new Error(`Cloud Agent Error: Couldn't resolve host "${hostname}". Make sure the domain is publicly accessible.`);
    }

    clearTimeout(timeoutId);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data;
    const contentType = response.headers.get("content-type");
    try {
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      throw new Error("Failed to parse response data");
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      time: 0, // Will be calculated by the calling component
      size: new TextEncoder().encode(JSON.stringify(data)).length
    };
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    // Ensure we always return a clean error message
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    throw new Error(errorMessage);
  }
}