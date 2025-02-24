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
  try {
    // Validate URL
    if (!url) {
      throw new Error("URL is required");
    }

    // Ensure URL is properly formatted
    const requestUrl = url.startsWith('http') ? url : `https://${url}`;

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(requestUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
        time: 0, // Will be calculated by the calling component
        size: new TextEncoder().encode(JSON.stringify(data)).length
      };
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        throw new Error("Request timed out after 30 seconds. The server took too long to respond.");
      }

      if (!navigator.onLine) {
        throw new Error("No internet connection. Please check your network and try again.");
      }

      // Handle DNS resolution failures and other network errors
      if (fetchError instanceof TypeError) {
        const errorMessage = fetchError.message.toLowerCase();
        if (errorMessage.includes('failed to fetch') || errorMessage.includes('network error')) {
          throw new Error(`Cloud Agent Error: Couldn't resolve host "${new URL(requestUrl).hostname}". Make sure the domain is publicly accessible.`);
        }
      }

      // Handle other network errors
      throw new Error(`Network Error: Unable to connect to ${new URL(requestUrl).hostname}. The service might be down or unreachable.`);
    }
  } catch (error: any) {
    // Ensure we always return a clean error message
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unexpected error occurred while making the request.");
    }
  }
}